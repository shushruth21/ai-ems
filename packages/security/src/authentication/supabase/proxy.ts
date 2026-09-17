import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { needsMfa, toAssuranceLevel } from "../aal";

export interface SessionState {
  response: NextResponse;
  userId: string | null;
  /**
   * True when the account has a verified second factor that this session
   * hasn't satisfied. Derived partly from the session cookie, so it is a UX
   * gate only — `requireSession()` re-checks it against the Auth server.
   */
  mfaRequired: boolean;
}

/**
 * Refreshes the Supabase session cookie on every matched request and returns
 * the verified user id (or null). Must run before any route renders.
 */
export async function updateSession(
  request: NextRequest,
  requestHeaders: Headers,
): Promise<SessionState> {
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { response, userId: null, mfaRequired: false };

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getClaims() verifies the JWT signature — do not replace with getSession().
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims.sub;
  const userId = typeof sub === "string" ? sub : null;
  if (!userId) return { response, userId: null, mfaRequired: false };

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired = needsMfa({
    // The verified JWT is authoritative for the current level.
    currentLevel: toAssuranceLevel(data?.claims.aal),
    nextLevel: toAssuranceLevel(aal?.nextLevel),
  });
  return { response, userId, mfaRequired };
}
