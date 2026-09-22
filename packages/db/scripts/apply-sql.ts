/**
 * Applies supabase/migrations/*.sql (idempotent) after Prisma migrations —
 * the Node equivalent of infrastructure/scripts/apply-supabase-sql.sh, for
 * machines without psql.
 *
 * On plain PostgreSQL (no `auth` schema, e.g. local Docker) it first installs
 * the stand-ins from supabase/tests/supabase-stubs.sql so the RLS, storage and
 * trigger SQL can be applied unchanged. Never does that on Supabase.
 */
import "../load-env";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DIRECT_URL or DATABASE_URL");

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const { rows } = await client.query<{ exists: boolean }>(
    "select exists (select 1 from pg_namespace where nspname = 'auth') as exists",
  );
  if (!rows[0]?.exists) {
    await client.query(readFileSync(path.join(repo, "supabase/tests/supabase-stubs.sql"), "utf8"));
    console.warn("→ plain PostgreSQL detected: installed Supabase stand-ins (auth, storage)");
  }
  const dir = path.join(repo, "supabase/migrations");
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    await client.query("begin");
    try {
      await client.query(readFileSync(path.join(dir, file), "utf8"));
      await client.query("commit");
      console.warn(`→ applied ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} finally {
  await client.end();
}
