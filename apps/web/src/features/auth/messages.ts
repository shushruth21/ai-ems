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
};

export function queryMessage(params: {
  error?: string | string[];
  notice?: string | string[];
}): { tone: "danger" | "success"; message: string } | null {
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  if (error) return { tone: "danger", message: error };
  const notice = typeof params.notice === "string" ? NOTICES[params.notice] : undefined;
  return notice ? { tone: "success", message: notice } : null;
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}
