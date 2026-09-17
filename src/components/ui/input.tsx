import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const inputBase = cn(
  "w-full min-w-0 rounded-md border border-input bg-surface text-foreground shadow-xs",
  "placeholder:text-subtle-foreground",
  "transition-[border-color,box-shadow] duration-(--duration-fast) outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
  "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/20",
);

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        inputBase,
        "h-(--control-h) px-2.5 text-base",
        "file:mr-2 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className,
      )}
      {...props}
    />
  );
}
