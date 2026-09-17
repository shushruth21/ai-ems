/** Builds absolute URLs for Supabase email/OAuth redirects. */
export function authCallbackUrl(appUrl: string, next?: string): string {
  const url = new URL("/auth/callback", appUrl);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}

export function authConfirmUrl(appUrl: string, next?: string): string {
  const url = new URL("/auth/confirm", appUrl);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
