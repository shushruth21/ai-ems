#!/usr/bin/env node
/**
 * Checks the local toolchain and environment before development.
 *   pnpm doctor
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const results = [];
const check = (name, ok, hint) => results.push({ name, ok, hint });

const [major, minor] = process.versions.node.split(".").map(Number);
check(
  `Node ${process.versions.node}`,
  major > 22 || (major === 22 && minor >= 12),
  "Install Node 22.12+ (see .nvmrc)",
);

try {
  const pnpm = execSync("pnpm --version", { encoding: "utf8" }).trim();
  check(`pnpm ${pnpm}`, Number(pnpm.split(".")[0]) >= 10, "Run: corepack enable");
} catch {
  check("pnpm", false, "Run: corepack enable");
}

const envFile = existsSync(".env") ? readFileSync(".env", "utf8") : "";
check(".env present", envFile.length > 0, "cp .env.example .env and fill in values");
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "DATABASE_URL",
]) {
  const set =
    new RegExp(`^${key}=.+`, "m").test(envFile) &&
    !new RegExp(`^${key}=.*(xxx|your-project-ref)`, "m").test(envFile);
  check(`${key} set`, set, `Set ${key} in .env`);
}
check(
  "Prisma client generated",
  existsSync("packages/db/src/generated/prisma/client.ts"),
  "Run: pnpm db:generate",
);

let failed = 0;
for (const r of results) {
  if (!r.ok) failed++;
  console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : `  → ${r.hint}`}`);
}
process.exit(failed ? 1 : 0);
