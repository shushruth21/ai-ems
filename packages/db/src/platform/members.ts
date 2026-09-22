import {
  canChangeRole,
  canLeave,
  canReactivate,
  canRemove,
  canSuspend,
  OWNER_ROLE,
  POLICY_MESSAGES,
  type MemberFacts,
  type PolicyResult,
} from "@ai-ems/domain/organization/membership-policy";

import type { MembershipStatus } from "../generated/prisma/client";

import { recordAudit } from "./audit";
import { enqueueOutbox } from "./outbox";
import { PlatformError, type Db, type DbOrTx, type Tx } from "./types";

export interface MemberRow {
  id: string;
  profileId: string;
  name: string | null;
  email: string;
  roleKey: string;
  roleName: string;
  status: MembershipStatus;
  title: string | null;
  joinedAt: Date;
}

export async function listMembers(db: DbOrTx, organizationId: string): Promise<MemberRow[]> {
  const rows = await db.membership.findMany({
    where: { organizationId },
    select: {
      id: true,
      profileId: true,
      status: true,
      title: true,
      createdAt: true,
      profile: { select: { fullName: true, email: true } },
      role: { select: { key: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    profileId: r.profileId,
    name: r.profile.fullName,
    email: r.profile.email,
    roleKey: r.role.key,
    roleName: r.role.name,
    status: r.status,
    title: r.title,
    joinedAt: r.createdAt,
  }));
}

export async function listRoles(db: DbOrTx, organizationId: string) {
  return db.role.findMany({
    where: { organizationId },
    select: {
      id: true,
      key: true,
      name: true,
      isSystem: true,
      _count: { select: { permissions: true } },
    },
    orderBy: { name: "asc" },
  });
}

async function activeOwnerCount(tx: DbOrTx, organizationId: string) {
  return tx.membership.count({
    where: { organizationId, status: "ACTIVE", role: { key: OWNER_ROLE } },
  });
}

async function facts(
  tx: DbOrTx,
  organizationId: string,
  membershipId: string,
): Promise<MemberFacts & { roleId: string }> {
  const m = await tx.membership.findFirst({
    where: { id: membershipId, organizationId },
    select: { profileId: true, status: true, roleId: true, role: { select: { key: true } } },
  });
  if (!m) throw new PlatformError("not_found", "Member not found.");
  return { profileId: m.profileId, roleKey: m.role.key, status: m.status, roleId: m.roleId };
}

function enforce(result: PolicyResult) {
  if (!result.ok) throw new PlatformError("forbidden", POLICY_MESSAGES[result.reason]);
}

interface Actor {
  organizationId: string;
  actorMembershipId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Serializes membership changes per organization (advisory lock) so two
 * concurrent demotions can't both pass the "last owner" check.
 */
async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`org-members:${organizationId}`}))`;
}

export async function changeMemberRole(
  db: Db,
  actor: Actor,
  membershipId: string,
  roleKey: string,
) {
  await db.$transaction(async (tx: Tx) => {
    await lockOrganization(tx, actor.organizationId);
    const [a, t, owners] = await Promise.all([
      facts(tx, actor.organizationId, actor.actorMembershipId),
      facts(tx, actor.organizationId, membershipId),
      activeOwnerCount(tx, actor.organizationId),
    ]);
    enforce(canChangeRole({ actor: a, target: t, activeOwnerCount: owners }, roleKey));
    const role = await tx.role.findFirst({
      where: { organizationId: actor.organizationId, key: roleKey },
    });
    if (!role) throw new PlatformError("not_found", "Role not found.");
    if (role.id === t.roleId) return;
    await tx.membership.update({ where: { id: membershipId }, data: { roleId: role.id } });
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: a.profileId,
      action: "member.role_changed",
      entityType: "membership",
      entityId: membershipId,
      changes: { role: { from: t.roleKey, to: roleKey } },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    await enqueueOutbox(tx, [
      {
        organizationId: actor.organizationId,
        type: "member.role_changed",
        payload: { profileId: t.profileId, membershipId, roleName: role.name },
      },
    ]);
  });
}

export async function setMemberStatus(
  db: Db,
  actor: Actor,
  membershipId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  await db.$transaction(async (tx: Tx) => {
    await lockOrganization(tx, actor.organizationId);
    const [a, t, owners] = await Promise.all([
      facts(tx, actor.organizationId, actor.actorMembershipId),
      facts(tx, actor.organizationId, membershipId),
      activeOwnerCount(tx, actor.organizationId),
    ]);
    const f = { actor: a, target: t, activeOwnerCount: owners };
    enforce(status === "SUSPENDED" ? canSuspend(f) : canReactivate(f));
    await tx.membership.update({ where: { id: membershipId }, data: { status } });
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: a.profileId,
      action: status === "SUSPENDED" ? "member.suspended" : "member.reactivated",
      entityType: "membership",
      entityId: membershipId,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  });
}

export async function removeMember(db: Db, actor: Actor, membershipId: string) {
  await db.$transaction(async (tx: Tx) => {
    await lockOrganization(tx, actor.organizationId);
    const [a, t, owners] = await Promise.all([
      facts(tx, actor.organizationId, actor.actorMembershipId),
      facts(tx, actor.organizationId, membershipId),
      activeOwnerCount(tx, actor.organizationId),
    ]);
    enforce(canRemove({ actor: a, target: t, activeOwnerCount: owners }));
    await tx.membership.delete({ where: { id: membershipId } });
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: a.profileId,
      action: "member.removed",
      entityType: "membership",
      entityId: membershipId,
      changes: { profileId: t.profileId, role: t.roleKey },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  });
}

export async function leaveOrganization(db: Db, actor: Actor) {
  await db.$transaction(async (tx: Tx) => {
    await lockOrganization(tx, actor.organizationId);
    const [t, owners] = await Promise.all([
      facts(tx, actor.organizationId, actor.actorMembershipId),
      activeOwnerCount(tx, actor.organizationId),
    ]);
    enforce(canLeave({ target: t, activeOwnerCount: owners }));
    await tx.membership.delete({ where: { id: actor.actorMembershipId } });
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: t.profileId,
      action: "member.left",
      entityType: "membership",
      entityId: actor.actorMembershipId,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  });
}
