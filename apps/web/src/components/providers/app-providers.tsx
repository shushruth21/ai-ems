"use client";

import type { ReactNode } from "react";

import { Toaster } from "@ai-ems/ui/components/ui/sonner";
import { TooltipProvider } from "@ai-ems/ui/components/ui/tooltip";

import { MotionProvider } from "./motion-provider";
import { QueryProvider } from "./query-provider";
import { ThemeProvider } from "./theme-provider";

export function AppProviders({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <ThemeProvider nonce={nonce}>
      <QueryProvider>
        <MotionProvider>
          <TooltipProvider delayDuration={300} skipDelayDuration={150}>
            {children}
            <Toaster />
          </TooltipProvider>
        </MotionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
