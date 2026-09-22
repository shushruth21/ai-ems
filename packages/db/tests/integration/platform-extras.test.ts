import { randomBytes, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { ALL_PERMISSIONS, moduleOf, PERMISSIONS } from "@ai-ems/security/authorization/permissions";

import { PrismaClient } from "../../src/generated/prisma/client";
import {
  createApiKey,
  listApiKeys,
  MAX_ACTIVE_API_KEYS,
  revokeApiKey,
  verifyApiKey,
} from "../../src/platform/api-keys";
import { listAuditActions, listAuditEvents } from "../../src/platform/audit";
import {
  countUnread,
  createNotifications,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../src/platform/notifications";
import {
  claimOutboxBatch,
  completeOutbox,
  enqueueOutbox,
  failOutbox,
  MAX_ATTEMPTS,
  outboxStats,
  requeueStuckOutbox,
} from "../../src/platform/outbox";
import { provisionOrganization } from "../../src/platform/organizations";
import { createRole, deleteRole, listRoleDetails, updateRole } from "../../src/platform/roles";

/**
 * Roles, audit queries, notifications, the outbox and API keys against the
 * real migrations. These are the parts whose behaviour lives in SQL —
 * `FOR UPDATE SKIP LOCKED`, keyset pagination, unique constraints.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const migrationsDir = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));

describe.skipIf(!adminUrl)("platform extras (real schema)", () => {
  const dbName = `aiems_extras_${randomBytes(4).toString("hex")}`;
  let admin: pg.Client;
  let db: PrismaClient;
  let organizationId: string;
  let ownerId: string;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    const setup = new pg.Client({ connectionString: url.toString() });
    await setup.connect();
    for (const dir of readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()) {
      await setup.query(readFileSync(`${migrationsDir}/${dir}/migration.sql`, "utf8"));
    }
    for (const key of ALL_PERMISSIONS) {
      await setup.query("insert into permissions (key, module, description) values ($1, $2, $3)", [
        key,
        moduleOf(key),
        PERMISSIONS[key],
      ]);
    }
    await setup.end();
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });

    ownerId = randomUUID();
    const org = await provisionOrganization(db, {
      name: "Outbox Co",
      slug: `outbox-${randomBytes(3).toString("hex")}`,
      currency: "USD",
      timezone: "UTC",
      owner: { id: ownerId, email: `owner.${randomBytes(3).toString("hex")}@example.test` },
    });
    organizationId = org.id;
  });

  afterAll(async () => {
    await db?.$disconnect();
    await admin?.query(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  const actor = () => ({
    organizationId,
    actorProfileId: ownerId,
    actorPermissions: [...ALL_PERMISSIONS],
  });

  it("creates, edits and deletes custom roles without letting anyone escalate", async () => {
    const { id } = await createRole(db, actor(), {
      name: "Regional manager",
      description: "Runs one region",
      permissions: ["crm.lead.read", "crm.lead.write"],
    });
    const created = (await listRoleDetails(db, organizationId)).find((r) => r.id === id)!;
    expect(created.key).toBe("regional_manager");
    expect(created.isSystem).toBe(false);
    expect(created.permissions.sort()).toEqual(["crm.lead.read", "crm.lead.write"]);

    // An actor can't grant what they don't hold…
    const limited = { ...actor(), actorPermissions: ["crm.lead.read" as const] };
    await expect(
      createRole(db, limited, { name: "Sneaky", permissions: ["platform.settings.manage"] }),
    ).rejects.toMatchObject({ code: "forbidden" });
    // …nor take away a permission they don't hold themselves.
    await expect(
      updateRole(db, limited, id, { name: "Regional manager", permissions: ["crm.lead.read"] }),
    ).rejects.toMatchObject({ code: "forbidden" });

    await updateRole(db, actor(), id, {
      name: "Regional lead",
      description: null,
      permissions: ["crm.lead.read"],
    });
    const updated = (await listRoleDetails(db, organizationId)).find((r) => r.id === id)!;
    expect(updated.name).toBe("Regional lead");
    expect(updated.permissions).toEqual(["crm.lead.read"]);

    const owner = (await listRoleDetails(db, organizationId)).find((r) => r.key === "owner")!;
    await expect(deleteRole(db, actor(), owner.id)).rejects.toMatchObject({
      code: "invalid_state",
    });
    await deleteRole(db, actor(), id);
    expect((await listRoleDetails(db, organizationId)).some((r) => r.id === id)).toBe(false);
  });

  it("pages the audit log newest-first and filters by action", async () => {
    const all = await listAuditEvents(db, organizationId, {}, { limit: 2 });
    expect(all.rows).toHaveLength(2);
    expect(all.nextCursor).not.toBeNull();
    expect(BigInt(all.rows[0]!.id)).toBeGreaterThan(BigInt(all.rows[1]!.id));
    expect(all.rows[0]!.actorName).toBeTruthy();

    const next = await listAuditEvents(
      db,
      organizationId,
      {},
      { limit: 2, cursor: all.nextCursor! },
    );
    expect(BigInt(next.rows[0]!.id)).toBeLessThan(BigInt(all.rows[1]!.id));

    expect(await listAuditActions(db, organizationId)).toContain("role.created");
    const created = await listAuditEvents(db, organizationId, { action: "role.created" });
    expect(created.rows.every((r) => r.action === "role.created")).toBe(true);
    expect(
      (await listAuditEvents(db, organizationId, { from: new Date(Date.now() + 86_400_000) })).rows,
    ).toEqual([]);
  });

  it("hands each outbox event to exactly one worker and backs off on failure", async () => {
    await enqueueOutbox(db, [
      { organizationId, type: "member.joined", payload: { profileId: ownerId } },
      { organizationId, type: "security.changed", payload: { summary: "test" } },
      {
        organizationId,
        type: "member.joined",
        payload: {},
        availableAt: new Date(Date.now() + 60_000),
      },
    ]);

    // Two workers claim at the same time: no event is handed out twice.
    const [a, b] = await Promise.all([claimOutboxBatch(db, 5), claimOutboxBatch(db, 5)]);
    const claimed = [...a, ...b];
    expect(claimed).toHaveLength(2); // the delayed one isn't due yet
    expect(new Set(claimed.map((j) => j.id)).size).toBe(2);

    await completeOutbox(db, claimed[0]!.id);
    expect(await failOutbox(db, claimed[1]!, new Error("smtp refused"))).toBe("retry");
    const retried = await db.outboxEvent.findUniqueOrThrow({
      where: { id: BigInt(claimed[1]!.id) },
    });
    expect(retried.status).toBe("PENDING");
    expect(retried.lastError).toContain("smtp refused");
    expect(retried.availableAt.getTime()).toBeGreaterThan(Date.now());

    expect(
      await failOutbox(db, { ...claimed[1]!, attempts: MAX_ATTEMPTS }, new Error("still broken")),
    ).toBe("dead");
    expect((await outboxStats(db)).FAILED).toBe(1);

    // A worker that died mid-flight releases its events.
    await db.outboxEvent.update({
      where: { id: BigInt(claimed[1]!.id) },
      data: { status: "PROCESSING", availableAt: new Date(Date.now() - 10 * 60_000) },
    });
    expect(await requeueStuckOutbox(db)).toBe(1);
  });

  it("keeps notifications private to their recipient", async () => {
    const other = randomUUID();
    await db.profile.create({
      data: { id: other, email: `other.${randomBytes(3).toString("hex")}@example.test` },
    });
    await createNotifications(db, [
      { organizationId, recipientId: ownerId, type: "member.joined", title: "Someone joined" },
      { organizationId, recipientId: ownerId, type: "security.changed", title: "MFA required" },
      { organizationId, recipientId: other, type: "member.joined", title: "Not yours" },
    ]);
    expect(await countUnread(db, organizationId, ownerId)).toBe(2);
    const mine = await listNotifications(db, organizationId, ownerId);
    expect(mine.map((n) => n.title)).not.toContain("Not yours");

    // Another member's id can't be marked read by guessing it.
    const theirs = (await listNotifications(db, organizationId, other))[0]!;
    expect(await markNotificationRead(db, organizationId, ownerId, theirs.id)).toBe(false);
    expect(await markNotificationRead(db, organizationId, ownerId, mine[0]!.id)).toBe(true);
    expect(await markAllNotificationsRead(db, organizationId, ownerId)).toBe(1);
    expect(await countUnread(db, organizationId, ownerId)).toBe(0);
    expect(await countUnread(db, organizationId, other)).toBe(1);
  });

  it("issues API keys that verify once, expire, and can be revoked", async () => {
    const created = await createApiKey(
      db,
      { organizationId, actorProfileId: ownerId },
      {
        name: "Scanner",
        scopes: ["read"],
        expiresInDays: 30,
      },
    );
    expect(created.token).toMatch(/^aiems_[0-9a-f]{12}_[A-Za-z0-9_-]{43}$/);
    // Only the hash is stored.
    expect(await db.apiKey.count({ where: { keyHash: created.token } })).toBe(0);

    expect(await verifyApiKey(db, created.token)).toMatchObject({
      organizationId,
      scopes: ["read"],
    });
    expect(await verifyApiKey(db, `${created.token.slice(0, -1)}x`)).toBeNull();
    expect(await verifyApiKey(db, "not-a-key")).toBeNull();

    const expired = await createApiKey(
      db,
      { organizationId, actorProfileId: ownerId },
      {
        name: "Old",
        scopes: ["read", "write"],
      },
    );
    await db.apiKey.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await verifyApiKey(db, expired.token)).toBeNull();

    await revokeApiKey(db, { organizationId, actorProfileId: ownerId }, created.id);
    expect(await verifyApiKey(db, created.token)).toBeNull();
    await expect(
      revokeApiKey(db, { organizationId, actorProfileId: ownerId }, created.id),
    ).rejects.toMatchObject({ code: "not_found" });
    expect((await listApiKeys(db, organizationId)).length).toBeGreaterThanOrEqual(2);
  });

  it("caps the number of active keys", async () => {
    const keyOwner = randomUUID();
    const org = await provisionOrganization(db, {
      name: "Key Co",
      slug: `keys-${randomBytes(3).toString("hex")}`,
      currency: "USD",
      timezone: "UTC",
      owner: { id: keyOwner, email: `k.${randomBytes(3).toString("hex")}@example.test` },
    });
    const keyActor = { organizationId: org.id, actorProfileId: keyOwner };
    for (let i = 0; i < MAX_ACTIVE_API_KEYS; i++) {
      await createApiKey(db, keyActor, { name: `key ${i}`, scopes: ["read"] });
    }
    await expect(
      createApiKey(db, keyActor, { name: "one too many", scopes: ["read"] }),
    ).rejects.toMatchObject({ code: "limit_reached" });
  });
});
