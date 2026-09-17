"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Input } from "@ai-ems/ui/components/ui/input";
import { cn } from "@ai-ems/ui/lib/utils";

/** Password field with a show/hide toggle that keeps focus in the input. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        onMouseDown={(e) => e.preventDefault()}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center rounded-r-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}
