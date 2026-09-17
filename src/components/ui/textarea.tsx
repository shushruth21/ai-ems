import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

import { inputBase } from "./input";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(inputBase, "field-sizing-content min-h-20 px-2.5 py-2 text-base", className)}
      {...props}
    />
  );
}
