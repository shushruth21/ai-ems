import { cookies } from "next/headers";

import { LAST_ORG_COOKIE, LOGIN_PATH, MFA_PATH, ONBOARDING_PATH } from "@/lib/routes";
import { getSessionState } from "@/server/auth/session";
import { redirectTo } from "@/server/redirect";
import { prisma } from "@ai-ems/db/client";
import { listOrganizationsForProfile } from "@ai-ems/db/platform/organizations";

export const dynamic = "force-dynamic";

/**
 * `/app` — where sign-in lands. Opens the workspace the user used last (if
 * they're still a member), else their first workspace, else onboarding.
 */
export default async function AppLanding() {
  const state = await getSessionState();
  if (!state.user) redirectTo(state.revoked ? "/auth/session-expired" : LOGIN_PATH);
  if (state.user.mfaRequired) redirectTo(MFA_PATH);

  const orgs = await listOrganizationsForProfile(prisma, state.user.id);
  if (orgs.length === 0) redirectTo(ONBOARDING_PATH);
  const last = (await cookies()).get(LAST_ORG_COOKIE)?.value;
  const target = orgs.find((o) => o.slug === last) ?? orgs[0]!;
  redirectTo(`/${target.slug}/dashboard`);
}
