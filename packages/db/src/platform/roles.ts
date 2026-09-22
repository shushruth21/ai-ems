import {
  canCreateRole,
  canDeleteRole,
  canUpdateRole,
  ROLE_MESSAGES,
  roleKeyFromName,
  type RoleResult,
} from "@ai-ems/domain/organization/role-policy";
import { ALL_PERMISSIONS, type Permission } from "@ai-ems/security/authorization/permissions";

import { recordAudit } from "./audit";
import { PlatformError, type Db, type DbOrTx, type Tx } from "./types";

const PERMISSION_SET: ReadonlySet<string> = new Set(ALL_PERMISSIONS);

export interface RoleDetail {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: Permission[];
  memberCount: number;
}

export interface RoleActor {
  organizationId: string;
  actorProfileId: string;
  /** The actor's own effective permissions — the escalation ceiling. */
  actorPermissions: readonly Permission[];
  ip?: string | null;
  userAgent?: string | null;
}

function enforce(result: RoleResult) {
  if (result.ok) return;
  const base = ROLE_MESSAGES[result.reason];
  throw new PlatformError(
    result.reason === "escalation" ? "forbidden" : "invalid_state",
    result.details?.length ? `${base} (${result.details.join(", ")})` : base,
  );
}

export async function listRoleDetails(db: DbOrTx, organizationId: string): Promise<RoleDetail[]> {
  const roles = await db.role.findMany({
    where: { organizationId },
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      isSystem: true,
      permissions: { select: { permissionKey: true } },
      _count: { select: { memberships: true } },
    },
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
  });
  return roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    permissions: r.permissions
      .map((p) => p.permissionKey)
      .filter((k): k is Permission => PERMISSION_SET.has(k)),
    memberCount: r._count.memberships,
  }));
}

async function uniqueKey(tx: Tx, organizationId: string, name: string): Promise<string> {
  const base = roleKeyFromName(name);
  for (let i = 0; i < 50; i++) {
    const key = i === 0 ? base : `${base.slice(0, 36)}_${i + 1}`;
    const taken = await tx.role.count({ where: { organizationId, key } });
    if (!taken) return key;
  }
  throw new PlatformError("invalid_state", "Choose a different role name.");
}

export interface RoleInput {
  name: string;
  description?: string | null;
  permissions: Permission[];
}

export async function createRole(
  db: Db,
  actor: RoleActor,
  input: RoleInput,
): Promise<{ id: string }> {
  return db.$transaction(async (tx: Tx) => {
    const customRoleCount = await tx.role.count({
      where: { organizationId: actor.organizationId, isSystem: false },
    });
    enforce(canCreateRole(actor.actorPermissions, input.permissions, customRoleCount));
    const key = await uniqueKey(tx, actor.organizationId, input.name);
    const role = await tx.role.create({
      data: {
        organizationId: actor.organizationId,
        key,
        name: input.name,
        description: input.description || null,
        isSystem: false,
      },
      select: { id: true },
    });
    await tx.rolePermission.createMany({
      data: input.permissions.map((permissionKey) => ({ roleId: role.id, permissionKey })),
    });
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.actorProfileId,
      action: "role.created",
      entityType: "role",
      entityId: role.id,
      changes: { key, name: input.name, permissions: input.permissions },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return role;
  });
}

export async function updateRole(
  db: Db,
  actor: RoleActor,
  roleId: string,
  input: RoleInput,
): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const role = await tx.role.findFirst({
      where: { id: roleId, organizationId: actor.organizationId },
      select: {
        key: true,
        name: true,
        isSystem: true,
        permissions: { select: { permissionKey: true } },
        _count: { select: { memberships: true } },
      },
    });
    if (!role) throw new PlatformError("not_found", "Role not found.");
    const current = role.permissions.map((p) => p.permissionKey);
    enforce(
      canUpdateRole(
        { key: role.key, isSystem: role.isSystem, memberCount: role._count.memberships },
        actor.actorPermissions,
        current,
        input.permissions,
      ),
    );
    await tx.role.update({
      where: { id: roleId },
      data: { name: input.name, description: input.description || null },
    });
    const added = input.permissions.filter((p) => !current.includes(p));
    const removed = current.filter((p) => !input.permissions.includes(p as Permission));
    if (removed.length) {
      await tx.rolePermission.deleteMany({ where: { roleId, permissionKey: { in: removed } } });
    }
    if (added.length) {
      await tx.rolePermission.createMany({
        data: added.map((permissionKey) => ({ roleId, permissionKey })),
      });
    }
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.actorProfileId,
      action: "role.updated",
      entityType: "role",
      entityId: roleId,
      changes: { name: { from: role.name, to: input.name }, added, removed },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  });
}

export async function deleteRole(db: Db, actor: RoleActor, roleId: string): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const role = await tx.role.findFirst({
      where: { id: roleId, organizationId: actor.organizationId },
      select: { key: true, name: true, isSystem: true, _count: { select: { memberships: true } } },
    });
    if (!role) throw new PlatformError("not_found", "Role not found.");
    enforce(
      canDeleteRole({
        key: role.key,
        isSystem: role.isSystem,
        memberCount: role._count.memberships,
      }),
    );
    await tx.role.delete({ where: { id: roleId } });
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.actorProfileId,
      action: "role.deleted",
      entityType: "role",
      entityId: roleId,
      changes: { key: role.key, name: role.name },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  });
}
