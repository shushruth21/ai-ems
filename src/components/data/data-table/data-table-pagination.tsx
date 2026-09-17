"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";

/** "26–50 of 132" — exported for tests. */
export function rangeLabel(pageIndex: number, pageSize: number, rowCount: number): string {
  if (rowCount === 0) return "0 results";
  const start = pageIndex * pageSize + 1;
  const end = Math.min(rowCount, (pageIndex + 1) * pageSize);
  return `${formatNumber(start)}–${formatNumber(end)} of ${formatNumber(rowCount)}`;
}

export function DataTablePagination({
  pageIndex,
  pageSize,
  pageCount,
  rowCount,
  pageSizeOptions,
  canPrevious,
  canNext,
  onFirst,
  onPrevious,
  onNext,
  onLast,
  onPageSizeChange,
  selectedCount,
}: {
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  rowCount: number;
  pageSizeOptions: number[];
  canPrevious: boolean;
  canNext: boolean;
  onFirst: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onLast: () => void;
  onPageSizeChange: (size: number) => void;
  selectedCount: number;
}) {
  return (
    <nav
      aria-label="Table pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground"
    >
      <p aria-live="polite" className="tabular">
        {rangeLabel(pageIndex, pageSize, rowCount)}
        {selectedCount ? ` · ${formatNumber(selectedCount)} selected` : ""}
      </p>
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <span id="rows-per-page">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger size="sm" className="w-18" aria-labelledby="rows-per-page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="tabular">
          Page {pageCount ? pageIndex + 1 : 0} of {pageCount}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onFirst}
            disabled={!canPrevious}
            aria-label="First page"
            className="hidden sm:inline-flex"
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onPrevious}
            disabled={!canPrevious}
            aria-label="Previous page"
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onNext}
            disabled={!canNext}
            aria-label="Next page"
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={onLast}
            disabled={!canNext}
            aria-label="Last page"
            className="hidden sm:inline-flex"
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </nav>
  );
}
