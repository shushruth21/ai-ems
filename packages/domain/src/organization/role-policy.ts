/**
 * Rules for custom roles. Pure: callers load the facts (who the actor is,
 * what the role looks like, how many members use it) and this decides.
 */
export const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;
export const ROLE_NAME_MIN = 2;
export const ROLE_NAME_MAX = 40;
/** A workspace keeps its templates plus a sensible number of custom roles. */
export const MAX_CUSTOM_ROLES = 30;

export interface RoleFacts {
  key: string;
  isSystem: boolean;
  /** ACTIVE + SUSPENDED memberships currently on this role. */
  memberCount: number;
}

export type RoleDenial =
  "system_role" | "role_in_use" | "escalation" | "empty_permissions" | "limit_reached";

export type RoleResult = { ok: true } | { ok: false; reason: RoleDenial; details?: string[] };

const allow: RoleResult = { ok: true };
const deny = (reason: RoleDenial, details?: string[]): RoleResult => ({
  ok: false,
  reason,
  details,
});

/** "Shop floor lead" → "shop_floor_lead" (may need a uniqueness suffix). */
export function roleKeyFromName(name: string): string {
  const key = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
  return ROLE_KEY_PATTERN.test(key) ? key : `role_${key}`.slice(0, 40).replace(/_+$/g, "");
}

/**
 * Nobody may grant a permission they don't hold themselves — otherwise
 * "manage roles" would quietly mean "grant yourself anything".
 */
export function escalatingPermissions(
  actorPermissions: readonly string[],
  requested: readonly string[],
): string[] {
  const held = new Set(actorPermissions);
  return [...new Set(requested)].filter((p) => !held.has(p)).sort();
}

export function canCreateRole(
  actorPermissions: readonly string[],
  requested: readonly string[],
  customRoleCount: number,
): RoleResult {
  if (requested.length === 0) return deny("empty_permissions");
  if (customRoleCount >= MAX_CUSTOM_ROLES) return deny("limit_reached");
  const escalating = escalatingPermissions(actorPermissions, requested);
  return escalating.length ? deny("escalation", escalating) : allow;
}

/**
 * Editing also protects permissions the actor lacks but the role already has:
 * they may neither be removed silently nor added.
 */
export function canUpdateRole(
  role: RoleFacts,
  actorPermissions: readonly string[],
  current: readonly string[],
  requested: readonly string[],
): RoleResult {
  if (role.isSystem) return deny("system_role");
  if (requested.length === 0) return deny("empty_permissions");
  const held = new Set(actorPermissions);
  const currentSet = new Set(current);
  const requestedSet = new Set(requested);
  const added = [...requestedSet].filter((p) => !currentSet.has(p));
  const removed = [...currentSet].filter((p) => !requestedSet.has(p));
  const escalating = [...new Set([...added, ...removed])].filter((p) => !held.has(p)).sort();
  return escalating.length ? deny("escalation", escalating) : allow;
}

export function canDeleteRole(role: RoleFacts): RoleResult {
  if (role.isSystem) return deny("system_role");
  if (role.memberCount > 0) return deny("role_in_use");
  return allow;
}

export const ROLE_MESSAGES: Record<RoleDenial, string> = {
  system_role: "Built-in roles can't be changed. Duplicate one instead.",
  role_in_use: "Move the members on this role to another role first.",
  escalation: "You can only grant or remove permissions you hold yourself.",
  empty_permissions: "Give the role at least one permission.",
  limit_reached: `A workspace can have up to ${MAX_CUSTOM_ROLES} custom roles.`,
};
