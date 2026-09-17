import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import pg from "pg";

import { RateLimiter } from "@ai-ems/security/authentication/rate-limit";

import { PostgresRateLimitStore } from "../../src/auth/rate-limit-store";

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

  async function asUser<T>(
    userId: string,
    fn: () => Promise<T>,
    aal: "aal1" | "aal2" = "aal1",
  ): Promise<T> {
    await db.query("begin");
    try {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, aal }),
      ]);
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
      // Mirrors Supabase's default grants; RLS is what must deny access.
      "grant select, insert, update, delete on all tables in schema public to authenticated; grant usage on all sequences in schema public to authenticated",
    );
    await db.query(sql("supabase/migrations/0001_rls_foundation.sql"));
    await db.query(sql("supabase/migrations/0002_storage.sql"));
    await db.query(sql("supabase/migrations/0003_auth.sql"));
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
    await expect(db.query(sql("supabase/migrations/0003_auth.sql"))).resolves.toBeDefined();
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

  describe("phase 3: authentication", () => {
    const USER_C = "44444444-4444-4444-4444-444444444444";

    beforeAll(async () => {
      await db.query(`
        insert into profiles values ('${USER_C}','c@example.test',null,now(),now());
        insert into memberships values ('m3','orgA','${USER_C}','rA','ACTIVE');
        insert into auth.mfa_factors (user_id, status) values ('${USER_C}', 'verified');
        insert into auth.mfa_factors (user_id, status) values ('${USER_A}', 'unverified');
        insert into auth_events (profile_id, type) values ('${USER_A}', 'SIGN_IN_SUCCEEDED'), ('${USER_B}', 'SIGN_UP');
      `);
    });

    it("hides tenant data from aal1 sessions of users with a verified factor", async () => {
      const aal1 = await asUser(USER_C, () => db.query("select id from leads"), "aal1");
      expect(aal1.rowCount).toBe(0);
      const orgs = await asUser(USER_C, () => db.query("select id from organizations"), "aal1");
      expect(orgs.rowCount).toBe(0);
      const aal2 = await asUser(USER_C, () => db.query("select id from leads"), "aal2");
      expect(aal2.rows.map((r) => r.id)).toEqual(["l1"]);
    });

    it("does not require aal2 when the only factor is unverified", async () => {
      const rows = await asUser(USER_A, () => db.query("select id from leads"), "aal1");
      expect(rows.rows.map((r) => r.id)).toEqual(["l1"]);
    });

    it("shows users only their own security events and blocks writes", async () => {
      const rows = await asUser(USER_A, () => db.query("select type from auth_events"));
      expect(rows.rows).toEqual([{ type: "SIGN_IN_SUCCEEDED" }]);
      await expect(
        asUser(USER_A, () =>
          db.query(`insert into auth_events (profile_id, type) values ('${USER_A}', 'SIGN_UP')`),
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(db.query("update auth_events set type = 'X'")).rejects.toThrow(/append-only/);
    });

    it("keeps rate-limit buckets away from clients", async () => {
      await expect(
        asUser(USER_A, () => db.query("select * from rate_limit_buckets")),
      ).rejects.toThrow(/permission denied/);
    });

    it("counts atomically in fixed windows via PostgresRateLimitStore", async () => {
      let now = new Date("2026-03-01T10:00:00Z");
      const store = new PostgresRateLimitStore(
        async <Row>(text: string, params: unknown[]) =>
          (await db.query(text, params)).rows as Row[],
        { purgeProbability: 1 },
      );
      const limiter = new RateLimiter(store, () => now);
      const rule = { limit: 5, windowSeconds: 60 };

      const results = await Promise.all(
        Array.from({ length: 7 }, () => store.hit("ip:1", rule.windowSeconds, now)),
      );
      expect(results.map((r) => r.count).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(results[0]?.resetAt.toISOString()).toBe("2026-03-01T10:01:00.000Z");

      now = new Date("2026-03-01T10:00:45Z");
      expect(await limiter.consume("ip:1", rule)).toEqual({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 15,
      });

      now = new Date("2026-03-01T10:01:00Z");
      expect(await limiter.consume("ip:1", rule)).toEqual({
        allowed: true,
        remaining: 4,
        retryAfterSeconds: 0,
      });

      await limiter.reset("ip:1");
      const left = await db.query(
        "select count(*)::int as n from rate_limit_buckets where key = 'ip:1'",
      );
      expect(left.rows[0]).toEqual({ n: 0 });
    });

    it("purges expired data", async () => {
      await db.query(
        "insert into rate_limit_buckets values ('old', 1, '2000-01-01', '2000-01-01')",
      );
      await db.query("select app.purge_auth_data(365)");
      const res = await db.query(
        "select count(*)::int as n from rate_limit_buckets where key = 'old'",
      );
      expect(res.rows[0]).toEqual({ n: 0 });
    });
  });
});
