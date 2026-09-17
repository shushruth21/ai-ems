import { ArrowRight, Plus, Sparkles } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";

import { KpiCard } from "@ai-ems/ui/components/data/kpi-card";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { StatusBadge } from "@ai-ems/ui/components/data/status-badge";
import { PageContainer } from "@/components/layout/page-container";
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
import { Progress } from "@ai-ems/ui/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ai-ems/ui/components/ui/table";
import {
  sampleOrders,
  sampleRevenueTrend,
  sampleWorkCenters,
} from "@/features/preview/sample-data";
import { formatCompact, formatCurrency, formatDate, formatPercent } from "@ai-ems/ui/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

function loadTone(load: number) {
  if (load >= 0.9) return { tone: "danger" as const, label: "Over capacity soon" };
  if (load >= 0.75) return { tone: "warning" as const, label: "Busy" };
  return { tone: "primary" as const, label: "Healthy" };
}

export default async function DashboardPage({ params }: PageProps<"/preview/[org]/dashboard">) {
  const { org } = await params;
  const base = `/preview/${org}`;
  const orders = sampleOrders();
  const open = orders.filter((o) => !["CLOSED", "CANCELLED", "DRAFT"].includes(o.status));
  const recent = orders.slice(0, 6);

  return (
    <PageContainer>
      <PageHeader
        title="Good morning, Riley"
        description="Here is what needs your attention across sales, production and delivery."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href={`${base}/sales/orders` as Route}>View orders</Link>
            </Button>
            <Button asChild>
              <Link href={`${base}/sales/quotes/new` as Route}>
                <Plus /> New quote
              </Link>
            </Button>
          </>
        }
      />

      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <KpiCard
          label="Revenue booked"
          value={formatCurrency(712_400, "USD", { compact: true })}
          delta={0.124}
          deltaLabel="vs last month"
          trend={sampleRevenueTrend}
        />
        <KpiCard
          label="Open orders"
          value={formatCompact(open.length)}
          delta={0.05}
          deltaLabel="vs last month"
        />
        <KpiCard
          label="On-time delivery"
          value={formatPercent(0.934)}
          delta={-0.021}
          deltaLabel="vs last month"
        />
        <KpiCard
          label="Overdue invoices"
          value={formatCurrency(38_950)}
          delta={-0.18}
          deltaLabel="vs last month"
          upIsGood={false}
        />
      </section>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent sales orders</CardTitle>
            <CardDescription>Latest bookings across all owners</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`${base}/sales/orders` as Route}>
                  View all <ArrowRight />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-0 pb-1">
            <Table aria-label="Recent sales orders" density="compact" inset>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Promised</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">{o.number}</TableCell>
                    <TableCell className="max-w-40 truncate">{o.customer}</TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(o.promisedDate, "short")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(o.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="border-ai-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-ai" aria-hidden />
                AI daily brief
              </CardTitle>
              <CardAction>
                <Badge tone="ai">Sample</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3 text-base">
              <p>
                Assembly is at 91% of capacity this week. Three orders promised for Friday depend on
                it.
              </p>
              <p className="text-muted-foreground">
                Suggested: move two finishing jobs to Monday, or approve overtime on Thursday.
              </p>
              <div className="flex gap-2">
                <Button variant="ai" size="sm" disabled>
                  Review plan
                </Button>
                <Button variant="ghost" size="sm" disabled>
                  Dismiss
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                AI suggestions never change data without your approval.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Work center load</CardTitle>
              <CardDescription>Booked hours vs capacity, this week</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {sampleWorkCenters.map((wc) => {
                  const { tone, label } = loadTone(wc.load);
                  return (
                    <li key={wc.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{wc.name}</span>
                        <span className="text-muted-foreground">
                          {formatPercent(wc.load, 0)} · {label}
                        </span>
                      </div>
                      <Progress
                        value={wc.load * 100}
                        tone={tone}
                        aria-label={`${wc.name} load ${formatPercent(wc.load, 0)}`}
                      />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
