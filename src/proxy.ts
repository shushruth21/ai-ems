import { NextResponse, type NextRequest } from "next/server";

import { isAuthPage, isPublicPath, safeRedirectPath } from "@/lib/routes";
import { buildCsp, createNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

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

  const { response, userId } = await updateSession(request, requestHeaders);
  const { pathname, search } = request.nextUrl;

  let result: NextResponse = response;
  if (!userId && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(safeRedirectPath(pathname + search))}`;
    result = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => result.cookies.set(c));
  } else if (userId && isAuthPage(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = safeRedirectPath(request.nextUrl.searchParams.get("next"));
    url.search = "";
    result = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => result.cookies.set(c));
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
