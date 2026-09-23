import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { LeadForm } from "@/features/crm/components/lead-form";
import { requireOrgContext } from "@/server/org/context";
import { accountOptions } from "@ai-ems/db/crm/accounts";
import { contactOptions } from "@ai-ems/db/crm/contacts";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";

export const metadata: Metadata = { title: "New lead" };

export default async function NewLeadPage({ params }: PageProps<"/[org]/crm/leads/new">) {
  const { org } = await params;
  const ctx = await requireOrgContext(org, "crm.lead.write");
  const [accounts, contacts] = await Promise.all([accountOptions(ctx.db), contactOptions(ctx.db)]);

  return (
    <PageContainer>
      <PageHeader title="New lead" description="Capture the enquiry now; the details can follow." />
      <LeadForm slug={org} accounts={accounts} contacts={contacts} />
    </PageContainer>
  );
}
