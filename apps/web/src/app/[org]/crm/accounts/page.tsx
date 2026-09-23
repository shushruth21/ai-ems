import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { AccountsManager } from "@/features/crm/components/accounts-manager";
import { requireOrgContext, hasPermission } from "@/server/org/context";
import { listAccounts } from "@ai-ems/db/crm/accounts";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage({ params }: PageProps<"/[org]/crm/accounts">) {
  const { org } = await params;
  const ctx = await requireOrgContext(org, "crm.account.read");
  const accounts = await listAccounts(ctx.db);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Accounts"
        description="The companies you sell to, with their open work at a glance."
      />
      <AccountsManager
        slug={org}
        canWrite={hasPermission(ctx, "crm.account.write")}
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
          type: account.type,
          industry: account.industry,
          website: account.website,
          contactCount: account.contactCount,
          openLeadCount: account.openLeadCount,
        }))}
      />
    </PageContainer>
  );
}
