import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "animate-shimmer rounded-sm bg-[linear-gradient(90deg,var(--color-muted)_0%,var(--color-border)_50%,var(--color-muted)_100%)] bg-size-[200%_100%]",
        className,
      )}
      {...props}
    />
  );
}
