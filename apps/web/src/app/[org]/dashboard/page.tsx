import { ArrowRight, Circle, CircleCheck } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-container";
import { FormFeedback } from "@/components/forms/form-feedback";
import { ROADMAP } from "@/features/preview/roadmap";
import { getOrgContext, hasPermission } from "@/server/org/context";
import { KpiCard } from "@ai-ems/ui/components/data/kpi-card";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { Badge } from "@ai-ems/ui/components/ui/badge";
import { Button } from "@ai-ems/ui/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ai-ems/ui/components/ui/card";
import { prisma } from "@ai-ems/db/client";
import { listPendingInvitations } from "@ai-ems/db/platform/invitations";
import { listMembers } from "@ai-ems/db/platform/members";

export const metadata: Metadata = { title: "Dashboard" };

interface Step {
  id: string;
  title: string;
  description: string;
  done: boolean;
  href?: string;
  cta?: string;
}

export default async function WorkspaceDashboard({
  params,
  searchParams,
}: PageProps<"/[org]/dashboard">) {
  const { org } = await params;
  const ctx = await getOrgContext(org);
  const query = await searchParams;
  const canManageMembers = hasPermission(ctx, "platform.members.manage");
  const canManageSettings = hasPermission(ctx, "platform.settings.manage");

  const [members, invitations] = await Promise.all([
    listMembers(prisma, ctx.organization.id),
    canManageMembers ? listPendingInvitations(prisma, ctx.organization.id) : Promise.resolve([]),
  ]);
  const active = members.filter((m) => m.status === "ACTIVE");

  const steps: Step[] = [
    {
      id: "create",
      title: "Create your workspace",
      description: `${ctx.organization.name} is live.`,
      done: true,
    },
    {
      id: "invite",
      title: "Invite your team",
      description: "Give colleagues the access they need, by role.",
      done: active.length > 1 || invitations.length > 0,
      href: canManageMembers ? `/${org}/settings/members` : undefined,
      cta: "Invite people",
    },
    {
      id: "mfa",
      title: "Turn on two-factor authentication",
      description: "Protects your account even if a password leaks.",
      done: ctx.user.verifiedFactors.length > 0,
      href: "/account",
      cta: "Set it up",
    },
    {
      id: "settings",
      title: "Check your workspace settings",
      description: "Currency, time zone and legal details appear on documents.",
      done: ctx.organization.legalName !== null,
      href: canManageSettings ? `/${org}/settings` : undefined,
      cta: "Open settings",
    },
  ];
  const remaining = steps.filter((s) => !s.done);
  const notice = query.joined === "1" ? `You've joined ${ctx.organization.name}.` : null;
  const welcome = query.welcome === "1" ? `${ctx.organization.name} is ready.` : null;

  return (
    <PageContainer width="wide">
      <PageHeader
        title={`Welcome${ctx.user.fullName ? `, ${ctx.user.fullName.split(/\s+/)[0]}` : ""}`}
        description={`${ctx.organization.name} · ${ctx.role.name}`}
        meta={<Badge tone="neutral">{ctx.organization.plan.toLowerCase()} plan</Badge>}
      />
      {notice || welcome ? (
        <FormFeedback feedback={{ tone: "success", message: (welcome ?? notice)! }} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active members" value={active.length} hint={`${members.length} in total`} />
        <KpiCard
          label="Pending invitations"
          value={invitations.length}
          hint="Links expire after 7 days"
        />
        <KpiCard
          label="Your role"
          value={ctx.role.name}
          hint={`${ctx.permissions.length} permissions`}
        />
      </div>

      {remaining.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
            <CardDescription>
              {steps.length - remaining.length} of {steps.length} done
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3">
              {steps.map((step) => (
                <li key={step.id} className="flex flex-wrap items-center gap-3">
                  {step.done ? (
                    <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
                  ) : (
                    <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        step.done ? "font-medium text-muted-foreground line-through" : "font-medium"
                      }
                    >
                      {step.title}
                    </span>
                    <span className="block text-sm text-muted-foreground">{step.description}</span>
                  </span>
                  {!step.done && step.href ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={step.href as Route}>{step.cta}</Link>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>What&apos;s coming</CardTitle>
          <CardDescription>The modules in the sidebar unlock phase by phase.</CardDescription>
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/${org}/crm/leads` as Route}>
                Preview a module
                <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ROADMAP.slice(0, 6).map((entry) => (
              <li key={entry.title} className="flex items-baseline gap-2 text-sm">
                <Badge tone="neutral">Phase {entry.phase}</Badge>
                <span className="font-medium">{entry.title}</span>
                <span className="truncate text-muted-foreground">{entry.summary}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
