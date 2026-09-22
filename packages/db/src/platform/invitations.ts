import { createHash, randomBytes } from "node:crypto";

import {
  invitationExpiry,
  invitationMatchesEmail,
  invitationState,
  type InvitationState,
} from "@ai-ems/domain/organization/invitation";
import { canInviteWithRole, POLICY_MESSAGES } from "@ai-ems/domain/organization/membership-policy";

import { recordAudit } from "./audit";
import { ensureProfile, type ProfileInput } from "./profiles";
import { PlatformError, type Db, type DbOrTx, type Tx } from "./types";

/** Pending invitations per organization (abuse guard). */
export const MAX_PENDING_INVITATIONS = 100;

export function newInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}

/** Only the SHA-256 of a token is stored; the token itself exists only in the link. */
export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

interface Actor {
  organizationId: string;
  actorProfileId: string;
  actorRoleKey: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface CreatedInvitation {
  id: string;
  token: string;
  email: string;
  roleName: string;
  expiresAt: Date;
}

/**
 * Invites an address into a role. Re-inviting the same pending address
 * replaces the old link. Existing members can't be invited again.
 */
export async function createInvitation(
  db: Db,
  actor: Actor,
  email: string,
  roleKey: string,
): Promise<CreatedInvitation> {
  const policy = canInviteWithRole(
    { profileId: actor.actorProfileId, roleKey: actor.actorRoleKey, status: "ACTIVE" },
    roleKey,
  );
  if (!policy.ok) throw new PlatformError("forbidden", POLICY_MESSAGES[policy.reason]);

  return db.$transaction(async (tx: Tx) => {
    const role = await tx.role.findFirst({
      where: { organizationId: actor.organizationId, key: roleKey },
      select: { id: true, name: true },
    });
    if (!role) throw new PlatformError("not_found", "Role not found.");

    const member = await tx.membership.findFirst({
      where: { organizationId: actor.organizationId, profile: { email } },
      select: { id: true },
    });
    if (member) throw new PlatformError("already_member", "That person is already a member.");

    const now = new Date();
    await tx.invitation.updateMany({
      where: { organizationId: actor.organizationId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: now },
    });
    const pending = await tx.invitation.count({
      where: {
        organizationId: actor.organizationId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (pending >= MAX_PENDING_INVITATIONS) {
      throw new PlatformError("limit_reached", "Too many pending invitations. Revoke some first.");
    }

    const { token, tokenHash } = newInvitationToken();
    const invitation = await tx.invitation.create({
      data: {
        organizationId: actor.organizationId,
        email,
        roleId: role.id,
        tokenHash,
        invitedById: actor.actorProfileId,
        expiresAt: invitationExpiry(now),
      },
      select: { id: true, expiresAt: true },
    });
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.actorProfileId,
      action: "invitation.created",
      entityType: "invitation",
      entityId: invitation.id,
      changes: { email, role: roleKey },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return {
      id: invitation.id,
      token,
      email,
      roleName: role.name,
      expiresAt: invitation.expiresAt,
    };
  });
}

export interface PendingInvitation {
  id: string;
  email: string;
  roleKey: string;
  roleName: string;
  invitedBy: string | null;
  expiresAt: Date;
  createdAt: Date;
}

export async function listPendingInvitations(
  db: DbOrTx,
  organizationId: string,
): Promise<PendingInvitation[]> {
  const rows = await db.invitation.findMany({
    where: { organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      email: true,
      invitedById: true,
      expiresAt: true,
      createdAt: true,
      role: { select: { key: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const inviters = await db.profile.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.invitedById))] } },
    select: { id: true, fullName: true, email: true },
  });
  const byId = new Map(inviters.map((p) => [p.id, p.fullName ?? p.email]));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    roleKey: r.role.key,
    roleName: r.role.name,
    invitedBy: byId.get(r.invitedById) ?? null,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }));
}

export async function revokeInvitation(db: Db, actor: Actor, invitationId: string): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const res = await tx.invitation.updateMany({
      where: {
        id: invitationId,
        organizationId: actor.organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (res.count === 0)
      throw new PlatformError("not_found", "Invitation not found or no longer pending.");
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.actorProfileId,
      action: "invitation.revoked",
      entityType: "invitation",
      entityId: invitationId,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  });
}

/** Issues a fresh link (and expiry) for a pending invitation; the old link stops working. */
export async function reissueInvitation(
  db: Db,
  actor: Actor,
  invitationId: string,
): Promise<CreatedInvitation> {
  const existing = await db.invitation.findFirst({
    where: {
      id: invitationId,
      organizationId: actor.organizationId,
      acceptedAt: null,
      revokedAt: null,
    },
    select: { email: true, role: { select: { key: true } } },
  });
  if (!existing) throw new PlatformError("not_found", "Invitation not found or no longer pending.");
  return createInvitation(db, actor, existing.email, existing.role.key);
}

export interface InvitationView {
  id: string;
  email: string;
  state: InvitationState;
  organization: { id: string; slug: string; name: string };
  roleName: string;
  invitedBy: string | null;
  expiresAt: Date;
}

export async function findInvitationByToken(
  db: DbOrTx,
  token: string,
): Promise<InvitationView | null> {
  const inv = await db.invitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      invitedById: true,
      role: { select: { name: true } },
      organization: { select: { id: true, slug: true, name: true, archivedAt: true } },
    },
  });
  if (!inv || inv.organization.archivedAt) return null;
  const inviter = await db.profile.findUnique({
    where: { id: inv.invitedById },
    select: { fullName: true, email: true },
  });
  return {
    id: inv.id,
    email: inv.email,
    state: invitationState(inv),
    organization: {
      id: inv.organization.id,
      slug: inv.organization.slug,
      name: inv.organization.name,
    },
    roleName: inv.role.name,
    invitedBy: inviter ? (inviter.fullName ?? inviter.email) : null,
    expiresAt: inv.expiresAt,
  };
}

/**
 * Accepts an invitation for the signed-in profile. The invitation is
 * single-use and bound to its email address. Returns the workspace slug.
 */
export async function acceptInvitation(
  db: Db,
  token: string,
  profile: ProfileInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ slug: string }> {
  return db.$transaction(async (tx: Tx) => {
    const inv = await tx.invitation.findUnique({
      where: { tokenHash: hashInvitationToken(token) },
      select: {
        id: true,
        email: true,
        roleId: true,
        organizationId: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        organization: { select: { slug: true, archivedAt: true } },
      },
    });
    if (!inv || inv.organization.archivedAt)
      throw new PlatformError("not_found", "Invitation not found.");
    if (invitationState(inv) !== "pending") {
      throw new PlatformError("invalid_state", "This invitation is no longer valid.");
    }
    if (!invitationMatchesEmail(inv.email, profile.email)) {
      throw new PlatformError(
        "email_mismatch",
        "This invitation was sent to a different email address.",
      );
    }

    // Claim atomically: a second concurrent accept finds nothing to update.
    const claimed = await tx.invitation.updateMany({
      where: { id: inv.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date(), acceptedById: profile.id },
    });
    if (claimed.count === 0)
      throw new PlatformError("invalid_state", "This invitation is no longer valid.");

    await ensureProfile(tx, profile);
    const existing = await tx.membership.findUnique({
      where: {
        organizationId_profileId: { organizationId: inv.organizationId, profileId: profile.id },
      },
      select: { id: true },
    });
    if (existing)
      throw new PlatformError("already_member", "You're already a member of this workspace.");
    const membership = await tx.membership.create({
      data: {
        organizationId: inv.organizationId,
        profileId: profile.id,
        roleId: inv.roleId,
        status: "ACTIVE",
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      organizationId: inv.organizationId,
      actorId: profile.id,
      action: "invitation.accepted",
      entityType: "membership",
      entityId: membership.id,
      changes: { invitationId: inv.id },
      ...meta,
    });
    return { slug: inv.organization.slug };
  });
}
