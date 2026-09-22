import { randomBytes, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { ALL_PERMISSIONS, moduleOf, PERMISSIONS } from "@ai-ems/security/authorization/permissions";

import { PrismaClient } from "../../src/generated/prisma/client";
import {
  acceptInvitation,
  createInvitation,
  findInvitationByToken,
  listPendingInvitations,
  reissueInvitation,
  revokeInvitation,
} from "../../src/platform/invitations";
import {
  changeMemberRole,
  leaveOrganization,
  listMembers,
  removeMember,
  setMemberStatus,
} from "../../src/platform/members";
import {
  getMembershipContext,
  listOrganizationsForProfile,
  provisionOrganization,
  setRequireMfa,
  updateOrganization,
} from "../../src/platform/organizations";
import { PlatformError } from "../../src/platform/types";

/**
 * Runs the platform repositories against the real Prisma migrations
 * (prisma/migrations/*) on a throwaway PostgreSQL database.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const migrationsDir = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));

const person = (name: string) => ({
  id: randomUUID(),
  email: `${name}.${randomBytes(3).toString("hex")}@example.test`,
  fullName: name,
});

describe.skipIf(!adminUrl)("platform repositories (real schema)", () => {
  const dbName = `aiems_platform_${randomBytes(4).toString("hex")}`;
  let admin: pg.Client;
  let db: PrismaClient;

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
  });

  afterAll(async () => {
    await db?.$disconnect();
    await admin?.query(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  async function workspace(slug = `ws-${randomBytes(3).toString("hex")}`) {
    const owner = person("owner");
    const org = await provisionOrganization(db, {
      name: "Acme Studio",
      slug,
      currency: "USD",
      timezone: "America/New_York",
      owner,
    });
    const ctx = (await getMembershipContext(db, owner.id, slug))!;
    return { owner, org, ctx, slug };
  }

  async function join(
    orgId: string,
    slug: string,
    roleKey: string,
    inviter: { id: string },
    inviterRole = "owner",
  ) {
    const p = person(roleKey);
    const inv = await createInvitation(
      db,
      { organizationId: orgId, actorProfileId: inviter.id, actorRoleKey: inviterRole },
      p.email,
      roleKey,
    );
    await acceptInvitation(db, inv.token, p);
    const ctx = (await getMembershipContext(db, p.id, slug))!;
    return { p, ctx };
  }

  it("provisions a workspace with roles, sequences, owner and audit", async () => {
    const { owner, org, ctx, slug } = await workspace();
    expect(ctx.role.key).toBe("owner");
    expect(ctx.permissions).toHaveLength(ALL_PERMISSIONS.length);
    expect(await db.role.count({ where: { organizationId: org.id } })).toBe(11);
    expect(await db.sequence.count({ where: { organizationId: org.id } })).toBe(10);
    expect(
      await db.auditEvent.count({
        where: { organizationId: org.id, action: "organization.created" },
      }),
    ).toBe(1);
    expect((await listOrganizationsForProfile(db, owner.id)).map((o) => o.slug)).toEqual([slug]);

    await expect(
      provisionOrganization(db, {
        name: "Dup",
        slug,
        currency: "USD",
        timezone: "UTC",
        owner: person("x"),
      }),
    ).rejects.toMatchObject({ code: "slug_taken" });
  });

  it("hides workspaces from non-members and suspended members", async () => {
    const { org, owner, slug } = await workspace();
    expect(await getMembershipContext(db, person("stranger").id, slug)).toBeNull();
    const { p, ctx } = await join(org.id, slug, "viewer", owner);
    expect(ctx.permissions.every((k) => k.endsWith(".read"))).toBe(true);
    await setMemberStatus(
      db,
      {
        organizationId: org.id,
        actorMembershipId: (await getMembershipContext(db, owner.id, slug))!.membership.id,
      },
      ctx.membership.id,
      "SUSPENDED",
    );
    expect(await getMembershipContext(db, p.id, slug)).toBeNull();
    expect(await listOrganizationsForProfile(db, p.id)).toEqual([]);
  });

  it("runs the invitation lifecycle: single use, email-bound, revocable, reissuable", async () => {
    const { org, owner, slug } = await workspace();
    const actor = { organizationId: org.id, actorProfileId: owner.id, actorRoleKey: "owner" };
    const invitee = person("invitee");
    const inv = await createInvitation(db, actor, invitee.email, "sales_rep");
    expect(inv.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await db.invitation.count({ where: { tokenHash: inv.token } })).toBe(0); // only the hash is stored
    expect((await findInvitationByToken(db, inv.token))?.state).toBe("pending");

    await expect(acceptInvitation(db, inv.token, person("eve"))).rejects.toMatchObject({
      code: "email_mismatch",
    });

    const fresh = await reissueInvitation(db, actor, inv.id);
    expect((await findInvitationByToken(db, inv.token))?.state).toBe("revoked");
    await expect(acceptInvitation(db, inv.token, invitee)).rejects.toMatchObject({
      code: "invalid_state",
    });

    expect(await acceptInvitation(db, fresh.token, invitee)).toEqual({ slug });
    await expect(acceptInvitation(db, fresh.token, invitee)).rejects.toMatchObject({
      code: "invalid_state",
    });
    expect((await getMembershipContext(db, invitee.id, slug))?.role.key).toBe("sales_rep");

    await expect(createInvitation(db, actor, invitee.email, "viewer")).rejects.toMatchObject({
      code: "already_member",
    });
    const other = await createInvitation(db, actor, person("later").email, "viewer");
    expect((await listPendingInvitations(db, org.id)).map((i) => i.id)).toEqual([other.id]);
    await revokeInvitation(db, actor, other.id);
    expect(await listPendingInvitations(db, org.id)).toEqual([]);
  });

  it("only owners can hand out the owner role", async () => {
    const { org, owner, slug } = await workspace();
    const { p: adminP } = await join(org.id, slug, "admin", owner);
    await expect(
      createInvitation(
        db,
        { organizationId: org.id, actorProfileId: adminP.id, actorRoleKey: "admin" },
        person("x").email,
        "owner",
      ),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("protects the last owner, including under concurrency", async () => {
    const { org, owner, ctx, slug } = await workspace();
    const { ctx: second } = await join(org.id, slug, "owner", owner);
    const a = { organizationId: org.id, actorMembershipId: ctx.membership.id };
    const b = { organizationId: org.id, actorMembershipId: second.membership.id };

    // Two owners demote each other at the same time: exactly one may succeed.
    const results = await Promise.allSettled([
      changeMemberRole(db, a, second.membership.id, "admin"),
      changeMemberRole(db, b, ctx.membership.id, "admin"),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(PlatformError);
    expect(
      await db.membership.count({
        where: { organizationId: org.id, status: "ACTIVE", role: { key: "owner" } },
      }),
    ).toBe(1);

    const remainingOwner = (await listMembers(db, org.id)).find((m) => m.roleKey === "owner")!;
    await expect(
      leaveOrganization(db, { organizationId: org.id, actorMembershipId: remainingOwner.id }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("removes members, lets members leave, and audits everything", async () => {
    const { org, owner, ctx, slug } = await workspace();
    const { ctx: rep } = await join(org.id, slug, "sales_rep", owner);
    const { ctx: viewer } = await join(org.id, slug, "viewer", owner);
    const actor = { organizationId: org.id, actorMembershipId: ctx.membership.id };
    await expect(removeMember(db, actor, ctx.membership.id)).rejects.toMatchObject({
      code: "forbidden",
    });
    await removeMember(db, actor, rep.membership.id);
    await leaveOrganization(db, {
      organizationId: org.id,
      actorMembershipId: viewer.membership.id,
    });
    expect((await listMembers(db, org.id)).map((m) => m.roleKey)).toEqual(["owner"]);

    await updateOrganization(db, org.id, owner.id, {
      name: "Acme Studio Ltd",
      legalName: "Acme Studio Limited",
      taxId: null,
      currency: "EUR",
      timezone: "Europe/Berlin",
      locale: "de-DE",
    });
    await setRequireMfa(db, org.id, owner.id, true);
    expect((await getMembershipContext(db, owner.id, slug))?.organization).toMatchObject({
      name: "Acme Studio Ltd",
      currency: "EUR",
      requireMfa: true,
    });
    const actions = (
      await db.auditEvent.findMany({
        where: { organizationId: org.id },
        orderBy: { id: "asc" },
        select: { action: true },
      })
    ).map((e) => e.action);
    expect(actions).toEqual([
      "organization.created",
      "invitation.created",
      "invitation.accepted",
      "invitation.created",
      "invitation.accepted",
      "member.removed",
      "member.left",
      "organization.updated",
      "organization.mfa_required",
    ]);
  });
});
