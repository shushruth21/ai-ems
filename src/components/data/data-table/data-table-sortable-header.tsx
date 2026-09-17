import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

export function SortableHeader({
  sorted,
  align = "start",
  onToggle,
  children,
}: {
  sorted: false | "asc" | "desc";
  align?: "start" | "end";
  onToggle: ((event: unknown) => void) | undefined;
  children: ReactNode;
}) {
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <button
      type="button"
      onClick={(e: MouseEvent<HTMLButtonElement>) => onToggle?.(e)}
      className={cn(
        "-mx-1.5 inline-flex h-7 items-center gap-1 rounded-sm px-1.5 font-medium outline-none",
        "hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        sorted && "text-foreground",
        align === "end" && "flex-row-reverse",
      )}
    >
      {children}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} aria-hidden />
    </button>
  );
}
