import type { Metadata } from "next";
import Link from "next/link";

import { CreateOrganizationForm } from "@/features/organizations/components/create-organization-form";
import { currencyOptions, timeZoneOptions } from "@/features/organizations/options";
import { requireSession } from "@/server/auth/session";
import { redirectTo } from "@/server/redirect";
import { publicEnv } from "@ai-ems/config/env";
import { prisma } from "@ai-ems/db/client";
import { listOrganizationsForProfile } from "@ai-ems/db/platform/organizations";
import { Card, CardContent, CardDescription, CardHeader } from "@ai-ems/ui/components/ui/card";

export const metadata: Metadata = { title: "Create a workspace" };

export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  const user = await requireSession({ next: "/onboarding" });
  const orgs = await listOrganizationsForProfile(prisma, user.id);
  const creatingAnother = (await searchParams).new === "1";
  if (orgs.length > 0 && !creatingAnother) redirectTo("/app");
  const firstName = user.fullName?.split(/\s+/)[0];

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {creatingAnother
            ? "Create another workspace"
            : firstName
              ? `Welcome, ${firstName}`
              : "Welcome to AI EMS"}
        </h1>
        <p className="text-muted-foreground">
          A workspace holds one company&apos;s customers, products, orders and team. You&apos;ll be
          its owner.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardDescription>
            You can change the name, currency and time zone later in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrganizationForm
            appOrigin={publicEnv().NEXT_PUBLIC_APP_URL}
            currencies={currencyOptions()}
            timeZones={timeZoneOptions()}
          />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">
        Joining an existing company? Ask an administrator there to invite{" "}
        <span className="font-medium text-foreground">{user.email}</span>, then open the link in
        their email.
        {orgs.length > 0 ? (
          <>
            {" "}
            Or{" "}
            <Link href="/app" className="underline underline-offset-4">
              go back to your workspace
            </Link>
            .
          </>
        ) : null}
      </p>
    </div>
  );
}
