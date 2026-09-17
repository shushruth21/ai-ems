import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import pg from "pg";

/**
 * Applies the real Supabase SQL migrations to a throwaway database and checks
 * tenant isolation from the `authenticated` role's point of view.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const repo = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const sql = (p: string) => readFileSync(repo(p), "utf8");

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

describe.skipIf(!adminUrl)("row level security", () => {
  const dbName = `aiems_rls_${randomBytes(4).toString("hex")}`;
  let admin: pg.Client;
  let db: pg.Client;

  async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
    await db.query("begin");
    try {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      return await fn();
    } finally {
      await db.query("rollback");
    }
  }

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    db = new pg.Client({ connectionString: url.toString() });
    await db.connect();
    await db.query(sql("supabase/tests/supabase-stubs.sql"));
    await db.query(sql("supabase/tests/minimal-schema.sql"));
    await db.query(
      "grant select, insert, update, delete on all tables in schema public to authenticated",
    );
    await db.query(sql("supabase/migrations/0001_rls_foundation.sql"));
    await db.query(sql("supabase/migrations/0002_storage.sql"));
    await db.query(`
      insert into organizations values ('orgA','A'),('orgB','B');
      insert into profiles values ('${USER_A}','a@example.test',null,now(),now());
      insert into roles values ('rA','orgA');
      insert into role_permissions values ('rA','sales.order.read');
      insert into memberships values ('m1','orgA','${USER_A}','rA','ACTIVE');
      insert into memberships values ('m2','orgB','${USER_A}','rA','SUSPENDED');
      insert into leads values ('l1','orgA','mine'),('l2','orgB','theirs');
      insert into notifications values ('n1','orgA','${USER_A}'),('n2','orgA','${USER_B}');
      insert into api_keys values ('k1','orgA');
      insert into stock_movements values (1,'orgA');
      insert into audit_events values (1,'orgA');
    `);
  });

  afterAll(async () => {
    await db?.end();
    await admin?.query(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  it("is idempotent (migrations can be re-applied)", async () => {
    await expect(
      db.query(sql("supabase/migrations/0001_rls_foundation.sql")),
    ).resolves.toBeDefined();
    await expect(db.query(sql("supabase/migrations/0002_storage.sql"))).resolves.toBeDefined();
  });

  it("shows only rows of organizations with an ACTIVE membership", async () => {
    const leads = await asUser(USER_A, () => db.query("select id from leads order by id"));
    expect(leads.rows.map((r) => r.id)).toEqual(["l1"]);
    const orgs = await asUser(USER_A, () => db.query("select id from organizations"));
    expect(orgs.rows.map((r) => r.id)).toEqual(["orgA"]);
  });

  it("shows nothing to a user without memberships", async () => {
    const leads = await asUser(USER_B, () => db.query("select id from leads"));
    expect(leads.rowCount).toBe(0);
  });

  it("limits notifications to the recipient", async () => {
    const rows = await asUser(USER_A, () => db.query("select id from notifications"));
    expect(rows.rows.map((r) => r.id)).toEqual(["n1"]);
  });

  it("never exposes API keys to clients", async () => {
    const rows = await asUser(USER_A, () => db.query("select id from api_keys"));
    expect(rows.rowCount).toBe(0);
  });

  it("denies direct client writes", async () => {
    await expect(
      asUser(USER_A, () => db.query("insert into leads values ('l3','orgA','hack')")),
    ).rejects.toThrow(/row-level security/);
  });

  it("scopes permission checks to the organization", async () => {
    const res = await asUser(USER_A, () =>
      db.query(
        "select app.has_permission('orgA','sales.order.read') as a, app.has_permission('orgB','sales.order.read') as b",
      ),
    );
    expect(res.rows[0]).toEqual({ a: true, b: false });
  });

  it("keeps ledgers append-only", async () => {
    await expect(db.query("update stock_movements set organization_id = 'orgB'")).rejects.toThrow(
      /append-only/,
    );
    await expect(db.query("delete from audit_events")).rejects.toThrow(/append-only/);
  });

  it("syncs new auth users into profiles", async () => {
    await db.query(
      `insert into auth.users values ('33333333-3333-3333-3333-333333333333','new@example.test','{"full_name":"New User"}')`,
    );
    const res = await db.query(
      "select email, full_name from profiles where id = '33333333-3333-3333-3333-333333333333'",
    );
    expect(res.rows[0]).toEqual({ email: "new@example.test", full_name: "New User" });
  });
});
