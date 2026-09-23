import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { RecordCrumb } from "@/components/layout/record-crumb";
import { LeadWorkspace } from "@/features/crm/components/lead-workspace";
import { getOrgContext, hasPermission } from "@/server/org/context";
import { prisma } from "@ai-ems/db/client";
import { accountOptions } from "@ai-ems/db/crm/accounts";
import { listActivities } from "@ai-ems/db/crm/activities";
import { contactOptions } from "@ai-ems/db/crm/contacts";
import { getLead } from "@ai-ems/db/crm/leads";
import { listMembers } from "@ai-ems/db/platform/members";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { StatusBadge } from "@ai-ems/ui/components/data/status-badge";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadPage({ params }: PageProps<"/[org]/crm/leads/[leadId]">) {
  const { org, leadId } = await params;
  const ctx = await getOrgContext(org);
  const canAssign = hasPermission(ctx, "crm.lead.assign");
  const actor = { organizationId: ctx.organization.id, profileId: ctx.user.id, canAssign };

  const lead = await getLead(ctx.db, actor, leadId);
  if (!lead) notFound();

  const [activities, accounts, contacts, members] = await Promise.all([
    listActivities(ctx.db, lead.id),
    accountOptions(ctx.db),
    contactOptions(ctx.db),
    canAssign ? listMembers(prisma, ctx.organization.id) : Promise.resolve([]),
  ]);

  return (
    <PageContainer width="wide">
      <RecordCrumb label={lead.title} />
      <PageHeader
        title={lead.title}
        description={`${lead.number} · created ${lead.createdAt.toISOString().slice(0, 10)}`}
        actions={<StatusBadge status={lead.status} />}
      />
      <LeadWorkspace
        slug={org}
        canWrite={hasPermission(ctx, "crm.lead.write")}
        canAssign={canAssign}
        accounts={accounts}
        contacts={contacts}
        members={members
          .filter((m) => m.status === "ACTIVE")
          .map((m) => ({ id: m.profileId, name: m.name ?? m.email }))}
        lead={{
          id: lead.id,
          number: lead.number,
          title: lead.title,
          status: lead.status,
          source: lead.source,
          campaign: lead.campaign,
          accountId: lead.accountId ?? "",
          accountName: lead.accountName,
          contactId: lead.contactId ?? "",
          contactName: lead.contactName,
          ownerId: lead.ownerId,
          ownerName: lead.ownerName,
          estimatedValue: lead.estimatedValue,
          estimatedValueInput: lead.estimatedValue === null ? "" : String(lead.estimatedValue),
          nextFollowUpAt: lead.nextFollowUpAt?.toISOString().slice(0, 10) ?? null,
          lostReason: lead.lostReason,
          availableActions: lead.availableActions,
          createdAt: lead.createdAt.toISOString(),
        }}
        activities={activities.map((activity) => ({
          id: activity.id,
          type: activity.type,
          subject: activity.subject,
          body: activity.body,
          outcome: activity.outcome,
          occurredAt: activity.occurredAt.toISOString(),
          actorName: activity.actorName,
        }))}
      />
    </PageContainer>
  );
}
