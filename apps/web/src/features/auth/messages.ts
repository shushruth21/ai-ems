/** Messages for `?error=` and `?notice=` query parameters on auth pages. */
const ERRORS: Record<string, string> = {
  link_invalid: "That link is invalid or has expired. Request a new one.",
  oauth_failed: "We couldn't complete sign-in with that provider. Try again.",
  provider_disabled: "That sign-in option isn't available.",
  session_expired: "Your session ended. Sign in again to continue.",
};

const NOTICES: Record<string, string> = {
  "signed-out": "You've been signed out.",
  "password-updated": "Your password was updated.",
  "mfa-required":
    "A workspace you belong to requires two-factor authentication. Set up an authenticator app below to continue.",
  "left-organization": "You left the workspace.",
};

export function queryMessage(params: {
  error?: string | string[];
  notice?: string | string[];
}): { tone: "danger" | "success" | "warning"; message: string } | null {
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  if (error) return { tone: "danger", message: error };
  const notice = typeof params.notice === "string" ? NOTICES[params.notice] : undefined;
  if (!notice) return null;
  return { tone: params.notice === "mfa-required" ? "warning" : "success", message: notice };
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
