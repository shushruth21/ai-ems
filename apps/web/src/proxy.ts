import { NextResponse, type NextRequest } from "next/server";

import { decideRoute, isPreviewEnabled, LAST_ORG_COOKIE, orgSlugFromPath } from "@/lib/routes";
import { updateSession } from "@ai-ems/security/authentication/supabase/proxy";
import { buildCsp, createNonce } from "@ai-ems/security/http/csp";

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const { response, userId, mfaRequired } = await updateSession(request, requestHeaders);
  const { pathname, search, searchParams } = request.nextUrl;

  const decision = decideRoute({
    pathname,
    search,
    next: searchParams.get("next"),
    userId,
    mfaRequired,
    previewEnabled: isPreviewEnabled(),
  });

  let result: NextResponse = response;
  if (decision.action === "redirect") {
    result = NextResponse.redirect(new URL(decision.to, request.url));
    // Keep any refreshed session cookies.
    response.cookies.getAll().forEach((c) => result.cookies.set(c));
  }

  // Remember the workspace so /app can reopen it next time. Membership is
  // checked where it matters (the /[org] layout and /app), not here.
  const slug =
    decision.action === "continue" && userId && !mfaRequired ? orgSlugFromPath(pathname) : null;
  if (slug && request.cookies.get(LAST_ORG_COOKIE)?.value !== slug) {
    result.cookies.set(LAST_ORG_COOKIE, slug, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  result.headers.set("Content-Security-Policy", csp);
  return result;
}

export const config = {
  matcher: [
    // Everything except static assets and image optimization.
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|robots.txt|.*\\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
