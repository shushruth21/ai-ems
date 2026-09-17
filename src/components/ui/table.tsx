import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Semantic table primitives. Density is controlled by `data-density` on the
 * wrapper ("comfortable" | "compact"), which rows read via group selectors.
 */
export function Table({
  className,
  density = "comfortable",
  inset = false,
  containerClassName,
  ...props
}: ComponentProps<"table"> & {
  density?: "comfortable" | "compact";
  /** Align the first/last columns with card padding (tables inside cards). */
  inset?: boolean;
  containerClassName?: string;
}) {
  return (
    <div
      data-slot="table-container"
      data-density={density}
      // Wide tables scroll horizontally on small screens; keyboard users need
      // to be able to focus the scroll region (WCAG 2.1.1).
      role="region"
      aria-label={props["aria-label"] ? `${props["aria-label"]} (scrollable)` : undefined}
      tabIndex={0}
      className={cn(
        "group/table relative w-full overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        containerClassName,
      )}
    >
      <table
        data-slot="table"
        className={cn(
          "tabular w-full caption-bottom text-sm",
          inset &&
            "[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("sticky top-0 z-(--z-index-sticky) bg-surface [&_tr]:border-b", className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/60 data-[state=selected]:bg-accent/60",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground",
        "group-data-[density=compact]/table:h-8 group-data-[density=compact]/table:px-2",
        "[&:has([role=checkbox])]:w-9 [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "h-(--row-h) px-3 align-middle whitespace-nowrap",
        "group-data-[density=compact]/table:h-(--row-h-compact) group-data-[density=compact]/table:px-2",
        "[&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-3 text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}
