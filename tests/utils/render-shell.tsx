import { render, type RenderResult } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { previewShellContext } from "@/features/preview/sample-data";
import type { Permission } from "@/server/auth/permissions";

export function renderShell(
  children: ReactNode = <p>Page body</p>,
  { permissions }: { permissions?: Permission[] } = {},
): RenderResult {
  const ctx = previewShellContext("demo")!;
  return render(
    <ThemeProvider attribute="class">
      <TooltipProvider>
        <AppShell {...ctx} permissions={permissions ?? ctx.permissions}>
          {children}
        </AppShell>
      </TooltipProvider>
    </ThemeProvider>,
  );
}
