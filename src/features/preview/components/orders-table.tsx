"use client";

import { Download, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { createDataTableColumns, DataTable } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/sonner";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";

import type { SampleOrder } from "../sample-data";

const col = createDataTableColumns<SampleOrder>();

const columns = col.columns([
  col.accessor("number", {
    header: "Order",
    meta: { label: "Order" },
    cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
  }),
  col.accessor("customer", {
    header: "Customer",
    meta: { label: "Customer", cellClassName: "max-w-56 truncate" },
  }),
  col.accessor("status", {
    header: "Status",
    meta: { label: "Status" },
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  col.accessor("owner", { header: "Owner", meta: { label: "Owner" } }),
  col.accessor("promisedDate", {
    header: "Promised",
    sortFn: "datetime",
    meta: { label: "Promised date" },
    cell: (info) => <span className="text-muted-foreground">{formatDate(info.getValue())}</span>,
  }),
  col.accessor("paidRatio", {
    header: "Paid",
    enableGlobalFilter: false,
    meta: { label: "Paid", align: "end" },
    cell: (info) => (
      <span className="inline-flex items-center gap-2">
        <Progress value={info.getValue() * 100} className="w-14" aria-hidden />
        <span className="w-9 text-right text-muted-foreground">
          {formatPercent(info.getValue(), 0)}
        </span>
      </span>
    ),
  }),
  col.accessor("total", {
    header: "Total",
    enableGlobalFilter: false,
    meta: { label: "Total", align: "end" },
    cell: (info) => <span className="font-medium">{formatCurrency(info.getValue())}</span>,
  }),
]);

export function OrdersTable({ orders }: { orders: SampleOrder[] }) {
  const [active, setActive] = useState<SampleOrder | null>(null);
  const data = useMemo(() => orders, [orders]);

  return (
    <>
      <DataTable
        label="Sales orders"
        columns={columns}
        data={data}
        getRowId={(row) => row.id}
        enableSelection
        searchPlaceholder="Search orders, customers, owners…"
        initialSorting={[{ id: "number", desc: true }]}
        onRowClick={setActive}
        toolbar={
          <Button size="sm" onClick={() => toast.info("Creating orders arrives in Phase 9.")}>
            <Plus />
            <span className="sr-only sm:not-sr-only">New order</span>
          </Button>
        }
        renderBulkActions={(rows, clear) => (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.success(`Prepared an export of ${rows.length} orders`, {
                  description: "Sample data — no file was created.",
                });
                clear();
              }}
            >
              <Download /> Export
            </Button>
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear selection
            </Button>
          </>
        )}
        emptyState={
          <EmptyState
            size="sm"
            title="No sales orders yet"
            description="Confirmed quotes become sales orders."
          />
        }
      />

      <Sheet open={active !== null} onOpenChange={(open) => !open && setActive(null)}>
        <SheetContent>
          {active ? (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono">{active.number}</SheetTitle>
                <SheetDescription>{active.customer}</SheetDescription>
              </SheetHeader>
              <SheetBody>
                <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 py-2 text-base">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge status={active.status} />
                  </dd>
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd>{active.owner}</dd>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{formatDate(active.createdAt)}</dd>
                  <dt className="text-muted-foreground">Promised</dt>
                  <dd>{formatDate(active.promisedDate)}</dd>
                  <dt className="text-muted-foreground">Lines</dt>
                  <dd>{active.lines}</dd>
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="font-semibold">{formatCurrency(active.total)}</dd>
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd>{formatPercent(active.paidRatio, 0)}</dd>
                </dl>
              </SheetBody>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
