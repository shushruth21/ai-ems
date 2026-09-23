import { defineMachine } from "../workflow/state-machine";

/**
 * Lead lifecycle. Statuses mirror `LeadStatus` in the Prisma schema; the
 * transitions are data so the UI can offer exactly the actions that are legal
 * from the current status, and the server can check the same table.
 */
export type LeadStatus =
  "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "WON" | "LOST" | "DISQUALIFIED";

export type LeadAction =
  "contact" | "qualify" | "propose" | "win" | "lose" | "disqualify" | "reopen";

const OPEN: readonly LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"];

export const leadMachine = defineMachine<LeadStatus, LeadAction>("Lead", [
  { action: "contact", from: ["NEW"], to: "CONTACTED", permission: "crm.lead.write" },
  { action: "qualify", from: ["NEW", "CONTACTED"], to: "QUALIFIED", permission: "crm.lead.write" },
  { action: "propose", from: ["QUALIFIED"], to: "PROPOSAL", permission: "crm.lead.write" },
  { action: "win", from: ["QUALIFIED", "PROPOSAL"], to: "WON", permission: "crm.lead.write" },
  { action: "lose", from: [...OPEN], to: "LOST", permission: "crm.lead.write" },
  { action: "disqualify", from: [...OPEN], to: "DISQUALIFIED", permission: "crm.lead.write" },
  {
    action: "reopen",
    from: ["LOST", "DISQUALIFIED"],
    to: "CONTACTED",
    permission: "crm.lead.write",
  },
]);

/** A lead nobody can work on any more. */
export function isClosed(status: LeadStatus): boolean {
  return !OPEN.includes(status);
}

/** Closing as lost or disqualified must say why — it is what reporting reads. */
export function requiresReason(action: LeadAction): boolean {
  return action === "lose" || action === "disqualify";
}

export interface LeadFacts {
  status: LeadStatus;
  ownerId: string | null;
  /** Whether the lead has a contact or an account to work with. */
  hasContact: boolean;
  estimatedValue: number | null;
}

export interface ActorFacts {
  profileId: string;
  /** May work on any lead, not only their own. */
  canAssign: boolean;
}

export type LeadResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "not_owner"
        | "closed"
        | "invalid_transition"
        | "reason_required"
        | "needs_contact"
        | "needs_value";
    };

export const LEAD_MESSAGES: Record<Extract<LeadResult, { ok: false }>["reason"], string> = {
  not_owner: "This lead belongs to someone else. Ask an owner to reassign it first.",
  closed: "This lead is closed. Reopen it before making changes.",
  invalid_transition: "That isn't a valid next step for this lead.",
  reason_required: "Say why the lead was lost or disqualified.",
  needs_contact: "Add a contact or an account before qualifying this lead.",
  needs_value: "Add an estimated value before sending a proposal.",
};

const fail = (reason: Extract<LeadResult, { ok: false }>["reason"]): LeadResult => ({
  ok: false,
  reason,
});

/**
 * May this person edit this lead at all? Anyone who can reassign leads can
 * work on any of them; everyone else only on their own (or unassigned ones,
 * which is how a new lead gets picked up).
 */
export function canEditLead(lead: LeadFacts, actor: ActorFacts): LeadResult {
  if (actor.canAssign) return { ok: true };
  if (lead.ownerId && lead.ownerId !== actor.profileId) return fail("not_owner");
  return { ok: true };
}

/** May this person move the lead along? Adds the lifecycle rules on top. */
export function canTransition(
  lead: LeadFacts,
  actor: ActorFacts,
  action: LeadAction,
  options: { reason?: string | null } = {},
): LeadResult {
  const editable = canEditLead(lead, actor);
  if (!editable.ok) return editable;
  if (!leadMachine.can(lead.status, action)) {
    return fail(isClosed(lead.status) && action !== "reopen" ? "closed" : "invalid_transition");
  }
  if (requiresReason(action) && !options.reason?.trim()) return fail("reason_required");
  if (action === "qualify" && !lead.hasContact) return fail("needs_contact");
  if (action === "propose" && (lead.estimatedValue ?? 0) <= 0) return fail("needs_value");
  return { ok: true };
}

/** Reassignment is a permission, never something an owner can do to themselves. */
export function canAssignLead(actor: ActorFacts): LeadResult {
  return actor.canAssign ? { ok: true } : fail("not_owner");
}

/**
 * How overdue a follow-up is, in days — negative means it is still ahead.
 * Used for the "needs attention" view and, later, for AI prioritisation.
 */
export function followUpAgeDays(nextFollowUpAt: Date | null, now: Date): number | null {
  if (!nextFollowUpAt) return null;
  return Math.floor((now.getTime() - nextFollowUpAt.getTime()) / 86_400_000);
}
