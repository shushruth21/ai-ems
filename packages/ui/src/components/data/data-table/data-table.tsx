"use client";

import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
  useTable,
  type ColumnDef,
  type Row,
  type RowData,
} from "@tanstack/react-table";
import { SearchX } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Skeleton } from "../../ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { cn } from "../../../lib/utils";

import { EmptyState } from "../empty-state";
import { DataTablePagination } from "./data-table-pagination";
import { SortableHeader } from "./data-table-sortable-header";
import { DataTableToolbar } from "./data-table-toolbar";

export interface DataTableColumnMeta {
  /** Numeric/money columns align to the end. */
  align?: "start" | "end";
  /** Human label for the column visibility menu (defaults to the column id). */
  label?: string;
  headerClassName?: string;
  cellClassName?: string;
}

/**
 * The feature set shared by every client-side data table. Only what the
 * component renders is registered, so unused table features tree-shake away.
 */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, datetime: sortFn_datetime },
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { includesString: filterFn_includesString },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
  columnVisibilityFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;
export type DataTableColumn<TData extends RowData> = ColumnDef<DataTableFeatures, TData>;

/** Column helper bound to the data-table feature set. */
export function createDataTableColumns<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

export type Density = "comfortable" | "compact";

export interface DataTableProps<TData extends RowData> {
  columns: readonly DataTableColumn<TData>[];
  data: readonly TData[];
  getRowId: (row: TData) => string;
  /** Accessible name for the table. */
  label: string;
  loading?: boolean;
  searchPlaceholder?: string;
  enableSelection?: boolean;
  /** Rendered in the toolbar while rows are selected. */
  renderBulkActions?: (rows: TData[], clearSelection: () => void) => ReactNode;
  /** Extra toolbar controls (filters, primary action). */
  toolbar?: ReactNode;
  onRowClick?: (row: TData) => void;
  emptyState?: ReactNode;
  pageSize?: number;
  pageSizeOptions?: number[];
  initialDensity?: Density;
  initialSorting?: { id: string; desc: boolean }[];
  initialHiddenColumns?: string[];
  className?: string;
}

const SELECT_COLUMN_ID = "__select";
const EMPTY_SELECTION: Record<string, boolean> = {};

export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  label,
  loading = false,
  searchPlaceholder = "Search…",
  enableSelection = false,
  renderBulkActions,
  toolbar,
  onRowClick,
  emptyState,
  pageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  initialDensity = "comfortable",
  initialSorting = [],
  initialHiddenColumns = [],
  className,
}: DataTableProps<TData>) {
  const [density, setDensity] = useState<Density>(initialDensity);

  const allColumns = useMemo<DataTableColumn<TData>[]>(() => {
    if (!enableSelection) return [...columns];
    const helper = createDataTableColumns<TData>();
    const select = helper.display({
      id: SELECT_COLUMN_ID,
      enableSorting: false,
      enableHiding: false,
      header: ({ table }) => (
        <Checkbox
          aria-label="Select all rows on this page"
          checked={
            table.getIsAllPageRowsSelected()
              ? true
              : table.getIsSomePageRowsSelected()
                ? "indeterminate"
                : false
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onCheckedChange={(value) => row.toggleSelected(value === true)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    });
    return [select, ...columns];
  }, [columns, enableSelection]);

  // Initial state is captured once, like `useState` semantics.
  const [initialState] = useState(() => ({
    sorting: initialSorting,
    pagination: { pageIndex: 0, pageSize },
    columnVisibility: Object.fromEntries(initialHiddenColumns.map((id) => [id, false])),
  }));

  const rows = data as TData[];
  const table = useTable(
    {
      features: dataTableFeatures,
      columns: allColumns,
      data: rows,
      getRowId,
      initialState,
      enableRowSelection: enableSelection,
      globalFilterFn: "includesString",
      getColumnCanGlobalFilter: (column) => column.id !== SELECT_COLUMN_ID,
    },
    (state) => ({
      sorting: state.sorting,
      globalFilter: state.globalFilter,
      pagination: state.pagination,
      rowSelection: state.rowSelection,
      columnVisibility: state.columnVisibility,
    }),
  );

  const rowSelection = table.state.rowSelection ?? EMPTY_SELECTION;
  // Row models are memoized inside the table; this mapping is cheap.
  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);

  // Drop selections that no longer exist after the data changes.
  useEffect(() => {
    if (!enableSelection) return;
    const ids = new Set(rows.map(getRowId));
    if (Object.keys(rowSelection).some((id) => !ids.has(id))) {
      table.setRowSelection(
        Object.fromEntries(Object.entries(rowSelection).filter(([id]) => ids.has(id))),
      );
    }
  }, [rows, rowSelection, enableSelection, getRowId, table]);

  const globalFilter = String(table.state.globalFilter ?? "");
  const visibleRows = table.getRowModel().rows;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const visibleColumnCount = table.getVisibleLeafColumns().length;

  const onRowKeyDown = (
    event: KeyboardEvent<HTMLTableRowElement>,
    row: Row<DataTableFeatures, TData>,
  ) => {
    if (!onRowClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row.original);
    }
  };

  return (
    <div
      data-slot="data-table"
      className={cn("flex flex-col overflow-hidden rounded-lg border bg-surface", className)}
    >
      <DataTableToolbar
        search={globalFilter}
        onSearchChange={(value) => table.setGlobalFilter(value)}
        searchPlaceholder={searchPlaceholder}
        density={density}
        onDensityChange={setDensity}
        columns={table
          .getAllLeafColumns()
          .filter((c) => c.getCanHide())
          .map((c) => ({
            id: c.id,
            label: c.columnDef.meta?.label ?? c.id,
            visible: c.getIsVisible(),
            toggle: (visible: boolean) => c.toggleVisibility(visible),
          }))}
        selectedCount={selectedRows.length}
        bulkActions={
          selectedRows.length && renderBulkActions
            ? renderBulkActions(selectedRows, () => table.resetRowSelection(true))
            : null
        }
      >
        {toolbar}
      </DataTableToolbar>

      <Table
        aria-label={label}
        aria-busy={loading || undefined}
        density={density}
        containerClassName="border-t"
      >
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta;
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                    }
                    className={cn(meta?.align === "end" && "text-right", meta?.headerClassName)}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <SortableHeader
                        sorted={sorted}
                        align={meta?.align}
                        onToggle={header.column.getToggleSortingHandler()}
                      >
                        <table.FlexRender header={header} />
                      </SortableHeader>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: Math.min(pageSize, 8) }, (_, i) => (
              <TableRow key={`skeleton-${i}`} className="hover:bg-transparent">
                {Array.from({ length: visibleColumnCount }, (__, j) => (
                  <TableCell key={j}>
                    <Skeleton className={cn("h-4", j === 0 ? "w-4" : "w-full max-w-40")} />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : visibleRows.length ? (
            visibleRows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={onRowClick ? (e) => onRowKeyDown(e, row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                className={cn(
                  onRowClick && "cursor-pointer focus-visible:bg-muted focus-visible:outline-none",
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(meta?.align === "end" && "text-right", meta?.cellClassName)}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={visibleColumnCount} className="h-auto p-0 whitespace-normal">
                {globalFilter ? (
                  <EmptyState
                    size="sm"
                    icon={SearchX}
                    title="No matching results"
                    description={`Nothing matches “${globalFilter}”.`}
                    action={
                      <Button variant="outline" size="sm" onClick={() => table.setGlobalFilter("")}>
                        Clear search
                      </Button>
                    }
                  />
                ) : (
                  (emptyState ?? <EmptyState size="sm" title="No records yet" />)
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <DataTablePagination
        pageIndex={table.state.pagination.pageIndex}
        pageSize={table.state.pagination.pageSize}
        pageCount={table.getPageCount()}
        rowCount={filteredCount}
        pageSizeOptions={pageSizeOptions}
        canPrevious={table.getCanPreviousPage()}
        canNext={table.getCanNextPage()}
        onFirst={() => table.firstPage()}
        onPrevious={() => table.previousPage()}
        onNext={() => table.nextPage()}
        onLast={() => table.lastPage()}
        onPageSizeChange={(size) => table.setPageSize(size)}
        selectedCount={selectedRows.length}
      />
    </div>
  );
}
