import type { ComponentProps } from "react";

import { Input } from "@ai-ems/ui/components/ui/input";
import { cn } from "@ai-ems/ui/lib/utils";

/** Six-digit one-time code field (lets password managers and SMS/OS autofill help). */
export function OtpInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      spellCheck={false}
      className={cn("font-mono text-lg tracking-[0.4em] tabular-nums", className)}
      {...props}
    />
  );
}
