/** Authenticator assurance level helpers (Supabase: aal1 = password/OTP, aal2 = + MFA). */
export type AssuranceLevel = "aal1" | "aal2";

export interface AssuranceState {
  currentLevel: AssuranceLevel | null;
  nextLevel: AssuranceLevel | null;
}

/** True when the user has a verified second factor but this session hasn't used it yet. */
export function needsMfa(state: AssuranceState | null | undefined): boolean {
  return state?.nextLevel === "aal2" && state.currentLevel !== "aal2";
}

export function toAssuranceLevel(value: unknown): AssuranceLevel | null {
  return value === "aal1" || value === "aal2" ? value : null;
}
