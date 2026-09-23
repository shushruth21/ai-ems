"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useMemo } from "react";

import { createDataTableColumns, DataTable } from "@ai-ems/ui/components/data/data-table";
import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
import { StatusBadge } from "@ai-ems/ui/components/data/status-badge";
import { Button } from "@ai-ems/ui/components/ui/button";
import { formatCurrency } from "@ai-ems/ui/lib/format";

export interface ProductListRow {
  id: string;
  sku: string;
  name: string;
  status: string;
  categoryName: string;
  basePrice: number;
  leadTimeDays: number;
  isConfigurable: boolean;
  optionGroupCount: number;
}

const col = createDataTableColumns<ProductListRow>();

const columns = col.columns([
  col.accessor("sku", {
    header: "SKU",
    meta: { label: "SKU" },
    cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
  }),
  col.accessor("name", {
    header: "Product",
    meta: { label: "Product", cellClassName: "max-w-64 truncate font-medium" },
  }),
  col.accessor("categoryName", { header: "Category", meta: { label: "Category" } }),
  col.accessor("status", {
    header: "Status",
    meta: { label: "Status" },
    cell: (info) => <StatusBadge status={info.getValue()} />,
  }),
  col.accessor("optionGroupCount", {
    header: "Options",
    enableGlobalFilter: false,
    meta: { label: "Option groups", align: "end" },
    cell: (info) =>
      info.row.original.isConfigurable ? (
        <span>{info.getValue()}</span>
      ) : (
        <span className="text-muted-foreground">fixed</span>
      ),
  }),
  col.accessor("leadTimeDays", {
    header: "Lead time",
    enableGlobalFilter: false,
    meta: { label: "Lead time", align: "end" },
    cell: (info) => <span className="text-muted-foreground">{info.getValue()} d</span>,
  }),
  col.accessor("basePrice", {
    header: "From",
    enableGlobalFilter: false,
    meta: { label: "Base price", align: "end" },
    cell: (info) => <span className="font-medium">{formatCurrency(info.getValue())}</span>,
  }),
]);

export function ProductsTable({
  slug,
  products,
  canWrite,
}: {
  slug: string;
  products: ProductListRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const data = useMemo(() => products, [products]);

  return (
    <DataTable
      label="Products"
      columns={columns}
      data={data}
      getRowId={(row) => row.id}
      searchPlaceholder="Search products, SKUs…"
      initialSorting={[{ id: "name", desc: false }]}
      onRowClick={(row) => router.push(`/${slug}/catalog/products/${row.id}` as Route)}
      toolbar={
        canWrite ? (
          <Button size="sm" onClick={() => router.push(`/${slug}/catalog/products/new` as Route)}>
            <Plus />
            <span className="sr-only sm:not-sr-only">New product</span>
          </Button>
        ) : null
      }
      emptyState={
        <EmptyState
          size="sm"
          title="Nothing in the catalog yet"
          description={
            canWrite
              ? "Add what you sell — a price, a lead time, and the options people choose from."
              : "Products will appear here once someone adds them."
          }
        />
      }
    />
  );
}
