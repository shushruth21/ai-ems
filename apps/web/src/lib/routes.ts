/** Route classification and access decisions used by proxy.ts. Pure and unit-tested. */

/** Where a signed-in user lands when no `next` is given (organization home arrives in Phase 4). */
export const DEFAULT_AFTER_LOGIN = "/account";
export const LOGIN_PATH = "/login";
export const MFA_PATH = "/login/mfa";

export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/verify-email",
  "/auth/callback",
  "/auth/confirm",
  "/auth/session-expired",
  "/api/health",
] as const;

const PUBLIC_PREFIXES = ["/api/webhooks/", "/api/v1/", "/legal/"];

/** Pages only meaningful to signed-out visitors; signed-in users are sent onward. */
const SIGNED_OUT_ONLY = new Set(["/login", "/signup", "/forgot-password"]);

/**
 * Paths a signed-in user may use before completing MFA. Everything else that
 * needs a session (including /reset-password — Auth requires aal2 to change
 * the password of an MFA-protected account) goes through the MFA step first.
 */
const MFA_EXEMPT = new Set([MFA_PATH, "/auth/callback", "/auth/confirm", "/auth/session-expired"]);

export const SESSION_EXPIRED_PATH = "/auth/session-expired";

/**
 * The /preview UI sandbox (sample data, no session) is on by default in
 * development and off in production unless ENABLE_UI_PREVIEW=true.
 */
export function isPreviewEnabled(env: Record<string, string | undefined> = process.env): boolean {
  if (env.ENABLE_UI_PREVIEW === "true") return true;
  if (env.ENABLE_UI_PREVIEW === "false") return false;
  return env.NODE_ENV !== "production";
}

export function isPublicPath(pathname: string, previewEnabled = isPreviewEnabled()): boolean {
  if ((PUBLIC_PATHS as readonly string[]).includes(pathname)) return true;
  if (previewEnabled && (pathname === "/preview" || pathname.startsWith("/preview/"))) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isAuthPage(pathname: string): boolean {
  return SIGNED_OUT_ONLY.has(pathname);
}

/**
 * Only allow same-origin relative redirects (prevents open redirects).
 * Returns a path that may include a query string.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (
    !value ||
    value.length > 2048 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }
  try {
    const url = new URL(value, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}

/**
 * Accepts either a relative path or an absolute URL on the app's own origin
 * (Supabase email templates pass `{{ .RedirectTo }}` as an absolute URL).
 */
export function redirectPathFromUrl(
  value: string | null | undefined,
  appOrigin: string,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (!value) return fallback;
  if (value.startsWith("/")) return safeRedirectPath(value, fallback);
  try {
    const url = new URL(value);
    if (url.origin !== new URL(appOrigin).origin) return fallback;
    return safeRedirectPath(`${url.pathname}${url.search}`, fallback);
  } catch {
    return fallback;
  }
}

export function withNext(path: string, next: string | null | undefined): string {
  const safe = next ? safeRedirectPath(next, "") : "";
  if (!safe || safe === DEFAULT_AFTER_LOGIN) return path;
  return `${path}?next=${encodeURIComponent(safe)}`;
}

export interface RouteRequest {
  pathname: string;
  search: string;
  /** The `next` query parameter, if any. */
  next: string | null;
  userId: string | null;
  mfaRequired: boolean;
  previewEnabled: boolean;
}

export type RouteDecision = { action: "continue" } | { action: "redirect"; to: string };

export function decideRoute(req: RouteRequest): RouteDecision {
  const { pathname, userId } = req;
  const isPublic = isPublicPath(pathname, req.previewEnabled);
  const here = safeRedirectPath(`${pathname}${req.search}`);

  if (!userId) {
    if (pathname === MFA_PATH) return { action: "redirect", to: withNext(LOGIN_PATH, req.next) };
    if (isPublic) return { action: "continue" };
    return { action: "redirect", to: withNext(LOGIN_PATH, here) };
  }

  if (req.mfaRequired) {
    if (MFA_EXEMPT.has(pathname)) return { action: "continue" };
    if (isAuthPage(pathname)) return { action: "redirect", to: withNext(MFA_PATH, req.next) };
    if (isPublic) return { action: "continue" };
    return { action: "redirect", to: withNext(MFA_PATH, here) };
  }

  if (pathname === MFA_PATH || isAuthPage(pathname)) {
    return { action: "redirect", to: safeRedirectPath(req.next) };
  }
  return { action: "continue" };
}
