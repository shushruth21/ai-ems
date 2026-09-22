import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

import { inputBase } from "./input";

/**
 * Native <select> styled like Input. Prefer it for long option lists (time
 * zones, countries): built-in type-ahead, platform pickers on mobile, and
 * zero JavaScript.
 */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          inputBase,
          "h-(--control-h) appearance-none pr-8 pl-2.5 text-base",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
