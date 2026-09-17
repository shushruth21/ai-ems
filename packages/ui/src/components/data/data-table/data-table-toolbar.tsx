"use client";

import { Columns3, Rows2, Rows4, Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { Input } from "../../ui/input";
import { SimpleTooltip } from "../../ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";

import type { Density } from "./data-table";

export interface ToolbarColumn {
  id: string;
  label: string;
  visible: boolean;
  toggle: (visible: boolean) => void;
}

export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  density,
  onDensityChange,
  columns,
  selectedCount,
  bulkActions,
  children,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  density: Density;
  onDensityChange: (density: Density) => void;
  columns: ToolbarColumn[];
  selectedCount: number;
  bulkActions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2">
      {selectedCount > 0 && bulkActions ? (
        <div
          className="flex min-h-(--control-h-sm) flex-1 flex-wrap items-center gap-2"
          role="region"
          aria-label="Bulk actions"
        >
          <span className="px-1 text-sm font-medium" aria-live="polite">
            {selectedCount} selected
          </span>
          {bulkActions}
        </div>
      ) : (
        <div className="relative w-full max-w-xs flex-1 sm:w-auto">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Search table"
            className="h-(--control-h-sm) pr-8 pl-8 text-sm [&::-webkit-search-cancel-button]:hidden"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search field"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {children}
        <ToggleGroup
          type="single"
          value={density}
          onValueChange={(v) => v && onDensityChange(v as Density)}
          aria-label="Row density"
        >
          <SimpleTooltip label="Comfortable rows">
            <ToggleGroupItem value="comfortable" aria-label="Comfortable rows">
              <Rows2 />
            </ToggleGroupItem>
          </SimpleTooltip>
          <SimpleTooltip label="Compact rows">
            <ToggleGroupItem value="compact" aria-label="Compact rows">
              <Rows4 />
            </ToggleGroupItem>
          </SimpleTooltip>
        </ToggleGroup>
        {columns.length ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 />
                <span className="sr-only sm:not-sr-only">Columns</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={c.visible}
                  onCheckedChange={(v) => c.toggle(v === true)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {c.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
