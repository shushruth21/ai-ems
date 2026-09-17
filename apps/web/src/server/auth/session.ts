import "server-only";

import type { User } from "@supabase/supabase-js";
import { cache } from "react";

import { redirectTo } from "@/server/redirect";
import { LOGIN_PATH, MFA_PATH, SESSION_EXPIRED_PATH, withNext } from "@/lib/routes";
import {
  needsMfa,
  toAssuranceLevel,
  type AssuranceLevel,
} from "@ai-ems/security/authentication/aal";
import { isSessionGone } from "@ai-ems/security/authentication/session-errors";
import { getSupabaseServerClient } from "@ai-ems/security/authentication/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  aal: AssuranceLevel | null;
  mfaRequired: boolean;
  verifiedFactors: Array<{ id: string; name: string; createdAt: string }>;
  pendingFactorIds: string[];
  providers: string[];
  lastSignInAt: string | null;
}

/**
 * Authoritative session for the current request (memoized per request).
 * Unlike the proxy check, this asks the Auth server for the user, so factor
 * state can't be spoofed through the session cookie.
 */
export const getSessionState = cache(
  async (): Promise<{ user: SessionUser } | { user: null; revoked: boolean }> => {
    const supabase = await getSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !claimsData) return { user: null, revoked: false };
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      // A signed token whose session no longer exists server-side.
      if (isSessionGone(error)) return { user: null, revoked: true };
      throw error;
    }
    if (!data.user) return { user: null, revoked: true };
    return { user: toSessionUser(data.user, toAssuranceLevel(claimsData.claims.aal)) };
  },
);

export async function getSessionUser(): Promise<SessionUser | null> {
  return (await getSessionState()).user;
}

export function toSessionUser(user: User, aal: AssuranceLevel | null): SessionUser {
  const factors = user.factors ?? [];
  const verified = factors.filter((f) => f.status === "verified");
  const fullName = user.user_metadata?.full_name;
  const providers = user.app_metadata?.providers;
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: typeof fullName === "string" && fullName.trim() ? fullName : null,
    aal,
    mfaRequired: needsMfa({ currentLevel: aal, nextLevel: verified.length > 0 ? "aal2" : aal }),
    verifiedFactors: verified.map((f) => ({
      id: f.id,
      name: f.friendly_name || "Authenticator app",
      createdAt: f.created_at,
    })),
    pendingFactorIds: factors.filter((f) => f.status !== "verified").map((f) => f.id),
    providers: Array.isArray(providers)
      ? providers.filter((p): p is string => typeof p === "string")
      : [],
    lastSignInAt: user.last_sign_in_at ?? null,
  };
}

/**
 * Use at the top of every protected page, layout and server action.
 * `allowMfaPending` is only for the MFA challenge itself.
 */
export async function requireSession(
  options: { next?: string; allowMfaPending?: boolean } = {},
): Promise<SessionUser> {
  const state = await getSessionState();
  const { user } = state;
  if (!user) {
    // Revoked sessions must clear their cookies first, or the proxy would
    // keep treating the visitor as signed in and bounce them off /login.
    redirectTo(
      withNext(
        "revoked" in state && state.revoked ? SESSION_EXPIRED_PATH : LOGIN_PATH,
        options.next,
      ),
    );
  }
  if (user.mfaRequired && !options.allowMfaPending) redirectTo(withNext(MFA_PATH, options.next));
  return user;
}
