import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { LeadsTable } from "@/features/crm/components/leads-table";
import { getOrgContext, hasPermission } from "@/server/org/context";
import { listLeads } from "@ai-ems/db/crm/leads";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";

export const metadata: Metadata = { title: "Leads" };

export default async function LeadsPage({ params }: PageProps<"/[org]/crm/leads">) {
  const { org } = await params;
  const ctx = await getOrgContext(org);
  const leads = await listLeads(ctx.db);

  return (
    <PageContainer width="wide">
      <PageHeader title="Leads" description="Every enquiry, from first contact to won or lost." />
      <LeadsTable
        slug={org}
        canWrite={hasPermission(ctx, "crm.lead.write")}
        leads={leads.map((lead) => ({
          id: lead.id,
          number: lead.number,
          title: lead.title,
          status: lead.status,
          source: lead.source,
          accountName: lead.accountName,
          contactName: lead.contactName,
          ownerName: lead.ownerName,
          estimatedValue: lead.estimatedValue,
          nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
          createdAt: lead.createdAt.toISOString(),
        }))}
      />
    </PageContainer>
  );
}
