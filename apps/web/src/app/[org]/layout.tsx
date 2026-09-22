import type { Metadata } from "next";
import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/config/shell";
import { MfaRequiredNotice } from "@/features/organizations/components/mfa-required-notice";
import { getOrgContext } from "@/server/org/context";

export async function generateMetadata({ params }: LayoutProps<"/[org]">): Promise<Metadata> {
  const { org } = await params;
  const ctx = await getOrgContext(org);
  return {
    title: { default: ctx.organization.name, template: `%s · ${ctx.organization.name} · AI EMS` },
    robots: { index: false, follow: false },
  };
}

/** The authenticated workspace. Membership, permissions and the MFA policy are resolved here. */
export default async function OrgLayout({ children, params }: LayoutProps<"/[org]">) {
  const { org } = await params;
  const ctx = await getOrgContext(org);
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  if (ctx.mfaBlocked) {
    return (
      <MfaRequiredNotice
        organizationName={ctx.organization.name}
        hasFactor={ctx.user.verifiedFactors.length > 0}
        slug={org}
      />
    );
  }

  return (
    <AppShell
      user={{
        id: ctx.user.id,
        name: ctx.user.fullName ?? ctx.user.email,
        email: ctx.user.email,
        title: ctx.membership.title ?? ctx.role.name,
      }}
      organization={ctx.organization}
      organizations={ctx.organizations}
      permissions={ctx.permissions}
      basePath={`/${ctx.organization.slug}`}
      defaultCollapsed={collapsed}
    >
      {children}
    </AppShell>
  );
}
