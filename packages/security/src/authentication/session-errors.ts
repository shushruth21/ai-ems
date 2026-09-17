import { isAuthApiError, isAuthSessionMissingError } from "@supabase/supabase-js";

/**
 * True when Auth says the session no longer exists (revoked, user deleted,
 * token rejected) — as opposed to Auth being unreachable, where the local
 * session must be kept.
 */
export function isSessionGone(error: unknown): boolean {
  if (isAuthSessionMissingError(error)) return true;
  return isAuthApiError(error) && [401, 403, 404].includes(error.status);
}
