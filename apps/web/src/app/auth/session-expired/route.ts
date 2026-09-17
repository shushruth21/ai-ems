import { NextResponse, type NextRequest } from "next/server";

import { LOGIN_PATH, safeRedirectPath, withNext } from "@/lib/routes";
import { isSessionGone } from "@ai-ems/security/authentication/session-errors";
import { getSupabaseServerClient } from "@ai-ems/security/authentication/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /auth/session-expired?next=…
 * Reached when the session cookie holds a validly signed token whose session
 * was revoked server-side (e.g. "sign out of all devices"). Clears the local
 * session only if the Auth server confirms it is gone, then asks the user to
 * sign in again. Never signs out a session that is still valid.
 */
export async function GET(request: NextRequest) {
  const next = safeRedirectPath(request.nextUrl.searchParams.get("next"));
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  let target = next;
  if (error && !isSessionGone(error)) throw error;
  if (error || !data.user) {
    await supabase.auth.signOut({ scope: "local" });
    const login = withNext(LOGIN_PATH, next);
    target = `${login}${login.includes("?") ? "&" : "?"}error=session_expired`;
  }
  const res = NextResponse.redirect(new URL(target, request.url), 303);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
