/**
 * Rules for changing memberships. Pure: the caller loads the facts, this
 * decides. Keeps every workspace with at least one active owner and stops
 * privilege escalation through role edits.
 */
export const OWNER_ROLE = "owner";

export type MembershipState = "ACTIVE" | "SUSPENDED" | "INVITED";

export interface MemberFacts {
  profileId: string;
  roleKey: string;
  status: MembershipState;
}

export interface PolicyFacts {
  actor: MemberFacts;
  target: MemberFacts;
  /** Active owners in the organization, including the target if it is one. */
  activeOwnerCount: number;
}

export type PolicyDenial = "not_self" | "owner_only" | "last_owner" | "not_active";

export type PolicyResult = { ok: true } | { ok: false; reason: PolicyDenial };

const allow: PolicyResult = { ok: true };
const deny = (reason: PolicyDenial): PolicyResult => ({ ok: false, reason });

const isOwner = (m: MemberFacts) => m.roleKey === OWNER_ROLE;
const isLastActiveOwner = (f: PolicyFacts) =>
  isOwner(f.target) && f.target.status === "ACTIVE" && f.activeOwnerCount <= 1;

/** Only owners may grant, revoke or touch the owner role. */
function ownerGuard(f: PolicyFacts, newRoleKey?: string): PolicyResult | null {
  if ((isOwner(f.target) || newRoleKey === OWNER_ROLE) && !isOwner(f.actor))
    return deny("owner_only");
  return null;
}

export function canChangeRole(f: PolicyFacts, newRoleKey: string): PolicyResult {
  if (f.actor.profileId === f.target.profileId) return deny("not_self");
  const guard = ownerGuard(f, newRoleKey);
  if (guard) return guard;
  if (newRoleKey !== OWNER_ROLE && isLastActiveOwner(f)) return deny("last_owner");
  return allow;
}

export function canSuspend(f: PolicyFacts): PolicyResult {
  if (f.actor.profileId === f.target.profileId) return deny("not_self");
  const guard = ownerGuard(f);
  if (guard) return guard;
  if (f.target.status !== "ACTIVE") return deny("not_active");
  if (isLastActiveOwner(f)) return deny("last_owner");
  return allow;
}

export function canReactivate(f: PolicyFacts): PolicyResult {
  if (f.actor.profileId === f.target.profileId) return deny("not_self");
  const guard = ownerGuard(f);
  if (guard) return guard;
  return f.target.status === "SUSPENDED" ? allow : deny("not_active");
}

export function canRemove(f: PolicyFacts): PolicyResult {
  if (f.actor.profileId === f.target.profileId) return deny("not_self");
  const guard = ownerGuard(f);
  if (guard) return guard;
  if (isLastActiveOwner(f)) return deny("last_owner");
  return allow;
}

/** A member leaving on their own. */
export function canLeave(f: Omit<PolicyFacts, "actor">): PolicyResult {
  return isLastActiveOwner({ ...f, actor: f.target }) ? deny("last_owner") : allow;
}

/** Inviting someone into a role follows the same owner guard as assigning it. */
export function canInviteWithRole(actor: MemberFacts, roleKey: string): PolicyResult {
  return roleKey === OWNER_ROLE && !isOwner(actor) ? deny("owner_only") : allow;
}

export const POLICY_MESSAGES: Record<PolicyDenial, string> = {
  not_self: "You can't change your own membership here.",
  owner_only: "Only owners can grant, change or remove the owner role.",
  last_owner: "Every workspace needs at least one active owner. Make someone else an owner first.",
  not_active: "That member isn't in the right state for this action.",
};
