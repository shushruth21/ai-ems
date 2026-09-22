/** Invitation lifecycle rules (pure). */
export const INVITATION_TTL_DAYS = 7;

export type InvitationState = "pending" | "accepted" | "revoked" | "expired";

export interface InvitationFacts {
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}

export function invitationState(inv: InvitationFacts, now: Date = new Date()): InvitationState {
  if (inv.acceptedAt) return "accepted";
  if (inv.revokedAt) return "revoked";
  if (inv.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

export function invitationExpiry(now: Date = new Date(), days = INVITATION_TTL_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Invitations are bound to an address; comparison ignores case and surrounding spaces. */
export function invitationMatchesEmail(
  invited: string,
  signedIn: string | null | undefined,
): boolean {
  return !!signedIn && invited.trim().toLowerCase() === signedIn.trim().toLowerCase();
}
