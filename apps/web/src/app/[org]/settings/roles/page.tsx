import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { RolesManager } from "@/features/platform/components/roles-manager";
import { getOrgContext, hasPermission } from "@/server/org/context";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { prisma } from "@ai-ems/db/client";
import { listRoleDetails } from "@ai-ems/db/platform/roles";
import { ALL_PERMISSIONS, moduleOf, PERMISSIONS } from "@ai-ems/security/authorization/permissions";

export const metadata: Metadata = { title: "Roles & permissions" };

export default async function RolesPage({ params }: PageProps<"/[org]/settings/roles">) {
  const { org } = await params;
  const ctx = await getOrgContext(org);
  const canManage = hasPermission(ctx, "platform.roles.manage");
  const roles = await listRoleDetails(prisma, ctx.organization.id);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Roles & permissions"
        description={
          canManage
            ? "Built-in roles cover most teams. Add a custom role when you need a narrower slice of access."
            : "What each role in this workspace can do."
        }
      />
      <RolesManager
        slug={org}
        canManage={canManage}
        granted={[...ctx.permissions]}
        roles={roles}
        permissions={ALL_PERMISSIONS.map((key) => ({
          key,
          module: moduleOf(key),
          description: PERMISSIONS[key],
        }))}
      />
    </PageContainer>
  );
}
