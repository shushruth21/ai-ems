"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useMemo } from "react";

import { createDataTableColumns, DataTable } from "@ai-ems/ui/components/data/data-table";
import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
import { StatusBadge } from "@ai-ems/ui/components/data/status-badge";
import { Button } from "@ai-ems/ui/components/ui/button";
import { formatCurrency, formatDate } from "@ai-ems/ui/lib/format";

export interface LeadListRow {
  id: string;
  number: string;
  title: string;
  status: string;
  source: string;
  accountName: string | null;
  contactName: string | null;
  ownerName: string | null;
  estimatedValue: number | null;
  nextFollowUpAt: string | null;
  createdAt: string;
}

const col = createDataTableColumns<LeadListRow>();

const columns = col.columns([
  col.accessor("number", {
    header: "Lead",
    meta: { label: "Number" },
    cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
  }),
  col.accessor("title", {
    header: "Title",
    meta: { label: "Title", cellClassName: "max-w-64 truncate font-medium" },
  }),
  col.accessor("accountName", {
    header: "Account",
    meta: { label: "Account", cellClassName: "max-w-48 truncate" },
    cell: (info) => info.getValue() ?? <span className="text-muted-foreground">—</span>,
  }),
  col.accessor("status", {
    header: "Status",
    meta: { label: "Status" },
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  col.accessor("ownerName", {
    header: "Owner",
    meta: { label: "Owner" },
    cell: (info) => info.getValue() ?? <span className="text-muted-foreground">Unassigned</span>,
  }),
  col.accessor("nextFollowUpAt", {
    header: "Follow-up",
    sortFn: "datetime",
    meta: { label: "Follow-up" },
    cell: (info) => {
      const value = info.getValue();
      if (!value) return <span className="text-muted-foreground">—</span>;
      const overdue = new Date(value).getTime() < Date.now();
      return (
        <span className={overdue ? "font-medium text-danger" : "text-muted-foreground"}>
          {formatDate(value)}
          {overdue ? <span className="sr-only"> (overdue)</span> : null}
        </span>
      );
    },
  }),
  col.accessor("estimatedValue", {
    header: "Value",
    enableGlobalFilter: false,
    meta: { label: "Estimated value", align: "end" },
    cell: (info) => {
      const value = info.getValue();
      return value === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="font-medium">{formatCurrency(value)}</span>
      );
    },
  }),
]);

export function LeadsTable({
  slug,
  leads,
  canWrite,
}: {
  slug: string;
  leads: LeadListRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const data = useMemo(() => leads, [leads]);

  return (
    <DataTable
      label="Leads"
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      searchPlaceholder="Search leads, numbers, accounts…"
      initialSorting={[{ id: "number", desc: true }]}
      onRowClick={(row) => router.push(`/${slug}/crm/leads/${row.id}` as Route)}
      toolbar={
        canWrite ? (
          <Button size="sm" onClick={() => router.push(`/${slug}/crm/leads/new` as Route)}>
            <Plus />
            <span className="sr-only sm:not-sr-only">New lead</span>
          </Button>
        ) : null
      }
      emptyState={
        <EmptyState
          size="sm"
          title="No leads yet"
          description={
            canWrite
              ? "Every enquiry starts here — walk-ins, website forms, referrals."
              : "Leads you can see will appear here."
          }
        />
      }
    />
  );
}
