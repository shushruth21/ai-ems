"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@ai-ems/ui/components/ui/button";
import { ScrollArea } from "@ai-ems/ui/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@ai-ems/ui/components/ui/sheet";
import { SimpleTooltip } from "@ai-ems/ui/components/ui/tooltip";
import { cn } from "@ai-ems/ui/lib/utils";

import { OrgSwitcher } from "./org-switcher";
import { useShell } from "./shell-context";
import { SidebarNav } from "./sidebar-nav";

function SidebarBody({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex h-(--topbar-h) shrink-0 items-center border-b border-sidebar-border px-2",
        )}
      >
        <OrgSwitcher />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <SidebarNav collapsed={collapsed} onNavigate={onNavigate} />
      </ScrollArea>
    </div>
  );
}

/** Desktop: persistent, collapsible rail. Mobile: slide-over sheet. */
export function AppSidebar() {
  const { collapsed, toggleCollapsed, mobileNavOpen, setMobileNavOpen } = useShell();

  return (
    <>
      <aside
        data-collapsed={collapsed}
        aria-label="Sidebar"
        className={cn(
          "sticky top-0 z-(--z-index-sidebar) hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex",
          "transition-[width] duration-(--duration-base) ease-(--ease-out) motion-reduce:transition-none",
          collapsed ? "w-(--sidebar-w-collapsed)" : "w-(--sidebar-w)",
        )}
      >
        <div className="min-h-0 flex-1">
          <SidebarBody collapsed={collapsed} />
        </div>
        <div
          className={cn(
            "flex shrink-0 border-t border-sidebar-border p-2",
            collapsed ? "justify-center" : "justify-end",
          )}
        >
          <SimpleTooltip
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            shortcut="["
            side="right"
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className="text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>
          </SimpleTooltip>
        </div>
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-[min(85%,18rem)] gap-0 bg-sidebar p-0"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
          <SidebarBody collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
