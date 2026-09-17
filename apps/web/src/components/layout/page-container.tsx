"use client";

import { m } from "framer-motion";
import type { ReactNode } from "react";

import { cn } from "@ai-ems/ui/lib/utils";

/** Standard page padding and max width, with a subtle entrance. */
export function PageContainer({
  children,
  className,
  width = "default",
}: {
  children: ReactNode;
  className?: string;
  width?: "default" | "wide" | "full";
}) {
  return (
    <m.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "mx-auto flex w-full min-w-0 flex-col gap-6 px-4 py-6 md:px-6 md:py-8",
        width === "default" && "max-w-7xl",
        width === "wide" && "max-w-[96rem]",
        className,
      )}
    >
      {children}
    </m.div>
  );
}
