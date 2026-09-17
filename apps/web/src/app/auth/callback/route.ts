import { NextResponse, type NextRequest } from "next/server";

import { LOGIN_PATH, MFA_PATH, safeRedirectPath, withNext } from "@/lib/routes";
import { auditAuthEvent } from "@/server/auth/audit";
import { getSupabaseServerClient } from "@ai-ems/security/authentication/supabase/server";

export const dynamic = "force-dynamic";

/**
 * OAuth (PKCE) callback: GET /auth/callback?code=…&next=…
 * Exchanges the one-time code for a session cookie, then continues to `next`
 * (or the MFA step when the account has a second factor).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));
  const flowId = searchParams.get("sb_flow_id");
  const to = (path: string) => {
    const res = NextResponse.redirect(new URL(path, request.url), 303);
    res.headers.set("Cache-Control", "no-store");
    return res;
  };

  if (!code || searchParams.has("error")) return to(`${LOGIN_PATH}?error=oauth_failed`);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(
    code,
    flowId ? { flowId } : undefined,
  );
  if (error || !data.user) return to(`${LOGIN_PATH}?error=link_invalid`);

  await auditAuthEvent("OAUTH_SUCCEEDED", {
    profileId: data.user.id,
    metadata: { provider: String(data.user.app_metadata?.provider ?? "unknown") },
  });
  const hasFactor = (data.user.factors ?? []).some((f) => f.status === "verified");
  return to(hasFactor ? withNext(MFA_PATH, next) : next);
}
