import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { MFA_PATH, withNext } from "@/lib/routes";
import { requireSession, type SessionUser } from "@/server/auth/session";
import { redirectTo } from "@/server/redirect";
import { prisma } from "@ai-ems/db/client";
import {
  getMembershipContext,
  listOrganizationsForProfile,
  type MembershipContext,
  type OrganizationSummary,
} from "@ai-ems/db/platform/organizations";
import { getTenantDb, type TenantDb } from "@ai-ems/db/tenant";
import { authorize, can, ForbiddenError } from "@ai-ems/security/authorization/authorize";
import type { Permission } from "@ai-ems/security/authorization/permissions";

export interface OrgContext extends MembershipContext {
  user: SessionUser;
  organizations: OrganizationSummary[];
  permissionSet: ReadonlySet<Permission>;
  /** Tenant-scoped client for this organization's data. */
  db: TenantDb;
  /** True when the workspace requires MFA and this session hasn't passed it. */
  mfaBlocked: boolean;
}

/**
 * Resolves the signed-in user's access to `/<slug>` once per request.
 * Non-members get a 404, never a hint that the workspace exists.
 */
export const getOrgContext = cache(async (slug: string): Promise<OrgContext> => {
  const user = await requireSession({ next: `/${slug}/dashboard` });
  const [membership, organizations] = await Promise.all([
    getMembershipContext(prisma, user.id, slug),
    listOrganizationsForProfile(prisma, user.id),
  ]);
  if (!membership) notFound();
  return {
    ...membership,
    user,
    organizations,
    permissionSet: new Set(membership.permissions),
    db: getTenantDb(membership.organization.id),
    mfaBlocked: membership.organization.requireMfa && user.aal !== "aal2",
  };
});

/**
 * For server actions and data loaders: the member must be allowed into the
 * workspace (MFA policy) and hold every listed permission.
 */
export async function requireOrgContext(
  slug: string,
  ...permissions: Permission[]
): Promise<OrgContext> {
  const ctx = await getOrgContext(slug);
  if (ctx.mfaBlocked) {
    // Users with a factor step up; others are sent to set one up.
    redirectTo(
      ctx.user.verifiedFactors.length > 0
        ? withNext(MFA_PATH, `/${slug}/dashboard`)
        : "/account?notice=mfa-required",
    );
  }
  const [first, ...rest] = permissions;
  if (first) authorize({ permissions: ctx.permissionSet }, first, ...rest);
  return ctx;
}

export function hasPermission(ctx: OrgContext, permission: Permission): boolean {
  return can({ permissions: ctx.permissionSet }, permission);
}

export { ForbiddenError };
