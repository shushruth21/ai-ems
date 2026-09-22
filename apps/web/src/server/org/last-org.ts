import "server-only";

import { cookies } from "next/headers";

import { LAST_ORG_COOKIE } from "@/lib/routes";

/**
 * Remembers the workspace for `/app`. The proxy does this for ordinary
 * navigation; server actions that redirect into a workspace call it directly,
 * because their redirect is served from the action response.
 */
export async function rememberOrganization(slug: string): Promise<void> {
  (await cookies()).set(LAST_ORG_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
