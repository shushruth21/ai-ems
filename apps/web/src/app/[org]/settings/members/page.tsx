import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { LeaveWorkspace } from "@/features/organizations/components/leave-workspace";
import { MembersManager } from "@/features/organizations/components/members-manager";
import { getOrgContext, hasPermission } from "@/server/org/context";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { prisma } from "@ai-ems/db/client";
import { listPendingInvitations } from "@ai-ems/db/platform/invitations";
import { listMembers, listRoles } from "@ai-ems/db/platform/members";

export const metadata: Metadata = { title: "Members & roles" };

export default async function MembersPage({ params }: PageProps<"/[org]/settings/members">) {
  const { org } = await params;
  const ctx = await getOrgContext(org);
  const canManage = hasPermission(ctx, "platform.members.manage");

  const [members, roles, invitations] = await Promise.all([
    listMembers(prisma, ctx.organization.id),
    listRoles(prisma, ctx.organization.id),
    canManage ? listPendingInvitations(prisma, ctx.organization.id) : Promise.resolve([]),
  ]);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Members & roles"
        description={
          canManage
            ? "Invite people, set what they can do, and remove access when they leave."
            : "Everyone with access to this workspace."
        }
      />
      <MembersManager
        slug={org}
        canManage={canManage}
        canAssignOwner={ctx.role.key === "owner"}
        roles={roles.map((r) => ({ key: r.key, name: r.name }))}
        members={members.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          roleKey: m.roleKey,
          roleName: m.roleName,
          status: m.status,
          isSelf: m.profileId === ctx.user.id,
          joinedAt: m.joinedAt.toISOString(),
        }))}
        invitations={invitations.map((i) => ({
          id: i.id,
          email: i.email,
          roleName: i.roleName,
          expiresAt: i.expiresAt.toISOString(),
        }))}
      />
      <LeaveWorkspace slug={org} organizationName={ctx.organization.name} />
    </PageContainer>
  );
}
