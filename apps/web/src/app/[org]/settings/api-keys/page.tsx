import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { ApiKeysManager } from "@/features/platform/components/api-keys-manager";
import { requireOrgContext } from "@/server/org/context";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { prisma } from "@ai-ems/db/client";
import { listApiKeys } from "@ai-ems/db/platform/api-keys";

export const metadata: Metadata = { title: "API keys" };

export default async function ApiKeysPage({ params }: PageProps<"/[org]/settings/api-keys">) {
  const { org } = await params;
  const ctx = await requireOrgContext(org, "platform.settings.manage");
  const keys = await listApiKeys(prisma, ctx.organization.id);

  return (
    <PageContainer width="wide">
      <PageHeader
        title="API keys"
        description="Keys authenticate machines — scripts, scanners and integrations — against this workspace only."
      />
      <ApiKeysManager
        slug={org}
        keys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          scopes: k.scopes,
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          expiresAt: k.expiresAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
          createdAt: k.createdAt.toISOString(),
        }))}
      />
    </PageContainer>
  );
}
