import { LoaderCircle } from "lucide-react";
import type { ComponentProps } from "react";

import { cn } from "../../lib/utils";

export function Spinner({
  className,
  label = "Loading",
  ...props
}: ComponentProps<"svg"> & { label?: string }) {
  return (
    <LoaderCircle
      role="status"
      aria-label={label}
      data-slot="spinner"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}
