import {
  ALL_PERMISSIONS,
  resolveRolePermissions,
  SYSTEM_ROLES,
  type Permission,
} from "@ai-ems/security/authorization/permissions";

import type { PlanTier } from "../generated/prisma/client";

import { recordAudit } from "./audit";
import { enqueueOutbox } from "./outbox";
import { ensureProfile, type ProfileInput } from "./profiles";
import { PlatformError, type Db, type DbOrTx, type Tx } from "./types";

/** Document sequences every organization starts with. */
export const DEFAULT_SEQUENCES = [
  ["lead", "LD"],
  ["quote", "QT"],
  ["sales_order", "SO"],
  ["purchase_order", "PO"],
  ["goods_receipt", "GR"],
  ["work_order", "WO"],
  ["inspection", "QI"],
  ["ncr", "NCR"],
  ["shipment", "SH"],
  ["invoice", "INV"],
] as const;

/** A user may own at most this many workspaces (abuse guard). */
export const MAX_OWNED_ORGANIZATIONS = 10;

const PERMISSION_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);
const isPermission = (key: string): key is Permission => PERMISSION_SET.has(key);

export interface OrganizationSummary {
  id: string;
  slug: string;
  name: string;
  plan: PlanTier;
  logoPath: string | null;
}

const summarySelect = { id: true, slug: true, name: true, plan: true, logoPath: true } as const;

/** Creates (or refreshes) the system roles and default sequences for an organization. */
export async function provisionRolesAndSequences(tx: DbOrTx, organizationId: string, year: number) {
  const roleIds: Record<string, string> = {};
  for (const [key, def] of Object.entries(SYSTEM_ROLES)) {
    const role = await tx.role.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: { name: def.name },
      create: { organizationId, key, name: def.name, isSystem: true },
    });
    roleIds[key] = role.id;
    await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
    await tx.rolePermission.createMany({
      data: resolveRolePermissions(key).map((permissionKey) => ({
        roleId: role.id,
        permissionKey,
      })),
    });
  }
  for (const [key, prefix] of DEFAULT_SEQUENCES) {
    await tx.sequence.upsert({
      where: { organizationId_key: { organizationId, key } },
      update: {},
      create: { organizationId, key, prefix, nextValue: 1, year },
    });
  }
  return roleIds;
}

export async function isSlugTaken(db: DbOrTx, slug: string): Promise<boolean> {
  return (await db.organization.count({ where: { slug } })) > 0;
}

export interface ProvisionInput {
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  owner: ProfileInput;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Creates a workspace with its roles, sequences and the creator as owner,
 * in one transaction. Permissions must already be seeded (`pnpm db:seed`).
 */
export async function provisionOrganization(
  db: Db,
  input: ProvisionInput,
): Promise<OrganizationSummary> {
  return db.$transaction(async (tx: Tx) => {
    await ensureProfile(tx, input.owner);
    const owned = await tx.membership.count({
      where: { profileId: input.owner.id, role: { key: "owner" } },
    });
    if (owned >= MAX_OWNED_ORGANIZATIONS) {
      throw new PlatformError(
        "limit_reached",
        `You can own up to ${MAX_OWNED_ORGANIZATIONS} workspaces.`,
      );
    }
    if (await isSlugTaken(tx, input.slug)) {
      throw new PlatformError("slug_taken", "That address is already taken.");
    }
    const organization = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        currency: input.currency,
        timezone: input.timezone,
      },
      select: summarySelect,
    });
    const roleIds = await provisionRolesAndSequences(
      tx,
      organization.id,
      new Date().getUTCFullYear(),
    );
    const membership = await tx.membership.create({
      data: {
        organizationId: organization.id,
        profileId: input.owner.id,
        roleId: roleIds.owner!,
        status: "ACTIVE",
      },
    });
    await recordAudit(tx, {
      organizationId: organization.id,
      actorId: input.owner.id,
      action: "organization.created",
      entityType: "organization",
      entityId: organization.id,
      changes: { name: input.name, slug: input.slug, ownerMembershipId: membership.id },
      ip: input.ip,
      userAgent: input.userAgent,
    });
    return organization;
  });
}

/** Workspaces the profile can open (ACTIVE memberships), alphabetical. */
export async function listOrganizationsForProfile(
  db: DbOrTx,
  profileId: string,
): Promise<OrganizationSummary[]> {
  const rows = await db.membership.findMany({
    where: { profileId, status: "ACTIVE", organization: { archivedAt: null } },
    select: { organization: { select: summarySelect } },
    orderBy: { organization: { name: "asc" } },
  });
  return rows.map((r) => r.organization);
}

export interface MembershipContext {
  organization: OrganizationSummary & {
    currency: string;
    timezone: string;
    locale: string;
    legalName: string | null;
    taxId: string | null;
    requireMfa: boolean;
  };
  membership: { id: string; title: string | null };
  role: { id: string; key: string; name: string };
  permissions: Permission[];
}

/**
 * Resolves the caller's access to a workspace by slug. Returns null when the
 * workspace doesn't exist, is archived, or the profile has no ACTIVE
 * membership — callers must not distinguish these (no existence leaks).
 */
export async function getMembershipContext(
  db: DbOrTx,
  profileId: string,
  slug: string,
): Promise<MembershipContext | null> {
  const membership = await db.membership.findFirst({
    where: { profileId, status: "ACTIVE", organization: { slug, archivedAt: null } },
    select: {
      id: true,
      title: true,
      organization: {
        select: {
          ...summarySelect,
          currency: true,
          timezone: true,
          locale: true,
          legalName: true,
          taxId: true,
          requireMfa: true,
        },
      },
      role: {
        select: {
          id: true,
          key: true,
          name: true,
          permissions: { select: { permissionKey: true } },
        },
      },
    },
  });
  if (!membership) return null;
  const { permissions, ...role } = membership.role;
  return {
    organization: membership.organization,
    membership: { id: membership.id, title: membership.title },
    role,
    permissions: permissions.map((p) => p.permissionKey).filter(isPermission),
  };
}

export interface OrganizationUpdate {
  name: string;
  legalName: string | null;
  taxId: string | null;
  currency: string;
  timezone: string;
  locale: string;
}

export async function updateOrganization(
  db: Db,
  organizationId: string,
  actorId: string,
  data: OrganizationUpdate,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const before = await tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: {
        name: true,
        legalName: true,
        taxId: true,
        currency: true,
        timezone: true,
        locale: true,
      },
    });
    await tx.organization.update({ where: { id: organizationId }, data });
    const changed = Object.fromEntries(
      (Object.keys(data) as Array<keyof OrganizationUpdate>)
        .filter((k) => before[k] !== data[k])
        .map((k) => [k, { from: before[k], to: data[k] }]),
    );
    if (Object.keys(changed).length === 0) return;
    await recordAudit(tx, {
      organizationId,
      actorId,
      action: "organization.updated",
      entityType: "organization",
      entityId: organizationId,
      changes: changed,
      ...meta,
    });
  });
}

export async function setRequireMfa(
  db: Db,
  organizationId: string,
  actorId: string,
  requireMfa: boolean,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    await tx.organization.update({ where: { id: organizationId }, data: { requireMfa } });
    await recordAudit(tx, {
      organizationId,
      actorId,
      action: requireMfa ? "organization.mfa_required" : "organization.mfa_optional",
      entityType: "organization",
      entityId: organizationId,
      ...meta,
    });
    await enqueueOutbox(tx, [
      {
        organizationId,
        type: "security.changed",
        payload: {
          actorId,
          summary: requireMfa
            ? "two-factor authentication is now required"
            : "two-factor authentication is no longer required",
          entityType: "organization",
          entityId: organizationId,
        },
      },
    ]);
  });
}
