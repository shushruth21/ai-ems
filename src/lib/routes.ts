/** Route classification used by proxy.ts. Pure and unit-tested. */
export const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/api/health",
] as const;

const PUBLIC_PREFIXES = ["/api/webhooks/", "/api/v1/", "/legal/"];

export function isPublicPath(pathname: string): boolean {
  if ((PUBLIC_PATHS as readonly string[]).includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}

/** Only allow same-origin relative redirects (prevents open redirects). */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/onboarding",
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return fallback;
  }
  return value;
}
