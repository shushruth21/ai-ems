import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { RecordCrumb } from "@/components/layout/record-crumb";
import { Configurator } from "@/features/catalog/components/configurator";
import { requireOrgContext } from "@/server/org/context";
import { getProductSpec } from "@ai-ems/db/catalog/configurator";
import { listLeads } from "@ai-ems/db/crm/leads";
import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";

export const metadata: Metadata = { title: "Configure" };

export default async function ConfigurePage({
  params,
  searchParams,
}: PageProps<"/[org]/catalog/products/[productId]/configure">) {
  const { org, productId } = await params;
  const query = await searchParams;
  const ctx = await requireOrgContext(org, "sales.quote.write");
  const spec = await getProductSpec(ctx.db, productId);
  if (!spec) notFound();

  const leads = await listLeads(ctx.db, { status: "OPEN" });
  const lead = Array.isArray(query.lead) ? query.lead[0] : query.lead;

  return (
    <PageContainer width="wide">
      <RecordCrumb label={`Configure ${spec.name}`} />
      <PageHeader
        title={`Configure ${spec.name}`}
        description={`${spec.sku} · from ${spec.basePrice}`}
      />
      {spec.status !== "ACTIVE" ? (
        <EmptyState
          title="This product isn't published"
          description="Only a published product can be configured and quoted."
        />
      ) : (
        <Configurator
          slug={org}
          spec={spec}
          defaultLeadId={lead}
          leads={leads.map((l) => ({ id: l.id, title: `${l.number} · ${l.title}` }))}
        />
      )}
    </PageContainer>
  );
}
