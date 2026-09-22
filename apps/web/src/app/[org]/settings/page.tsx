import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { OrganizationSettingsForm } from "@/features/organizations/components/organization-settings-form";
import { SecuritySettings } from "@/features/organizations/components/security-settings";
import { currencyOptions, localeOptions, timeZoneOptions } from "@/features/organizations/options";
import { getOrgContext, hasPermission } from "@/server/org/context";
import type { CURRENCIES, LOCALES } from "@ai-ems/contracts/organization";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ai-ems/ui/components/ui/card";

export const metadata: Metadata = { title: "Settings" };

export default async function WorkspaceSettings({ params }: PageProps<"/[org]/settings">) {
  const { org } = await params;
  const ctx = await getOrgContext(org);
  const canManage = hasPermission(ctx, "platform.settings.manage");
  const { organization } = ctx;

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description={
          canManage
            ? "Details used across documents and formatting."
            : "Read-only: ask an administrator to change these."
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>
            Address: <code className="font-mono">/{organization.slug}</code> — fixed once created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrganizationSettingsForm
            slug={org}
            disabled={!canManage}
            currencies={currencyOptions()}
            locales={localeOptions()}
            timeZones={timeZoneOptions()}
            defaults={{
              name: organization.name,
              legalName: organization.legalName ?? "",
              taxId: organization.taxId ?? "",
              currency: organization.currency as (typeof CURRENCIES)[number],
              timezone: organization.timezone,
              locale: organization.locale as (typeof LOCALES)[number],
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Security</CardTitle>
          <CardDescription>Rules that apply to everyone in this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <SecuritySettings slug={org} requireMfa={organization.requireMfa} disabled={!canManage} />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
