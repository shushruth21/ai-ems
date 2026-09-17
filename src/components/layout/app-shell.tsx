"use client";

import type { ReactNode } from "react";

import { MAIN_CONTENT_ID } from "@/config/shell";
import type { ShellContextValue } from "@/types/shell";

import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { GlobalHotkeys } from "./global-hotkeys";
import { ShellProvider } from "./shell-context";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { SkipLink } from "./skip-link";
import { Topbar } from "./topbar";

/**
 * The authenticated workspace frame. It is data-agnostic: the server layout
 * resolves user, organization and permissions and passes them in.
 */
export function AppShell({
  children,
  defaultCollapsed,
  ...value
}: ShellContextValue & { children: ReactNode; defaultCollapsed?: boolean }) {
  return (
    <ShellProvider value={value} defaultCollapsed={defaultCollapsed}>
      <SkipLink targetId={MAIN_CONTENT_ID} />
      <div className="flex min-h-dvh bg-background">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 outline-none">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
      <ShortcutsDialog />
      <GlobalHotkeys />
    </ShellProvider>
  );
}
