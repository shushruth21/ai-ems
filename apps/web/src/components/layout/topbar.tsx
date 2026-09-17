"use client";

import { Menu, Search, Sparkles } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Button } from "@ai-ems/ui/components/ui/button";
import { Kbd, KbdGroup } from "@ai-ems/ui/components/ui/kbd";
import { SimpleTooltip } from "@ai-ems/ui/components/ui/tooltip";
import { joinPath } from "@/config/navigation";
import { useIsApple } from "@ai-ems/ui/hooks/use-platform";

import { AppBreadcrumbs } from "./app-breadcrumbs";
import { NotificationsButton } from "./notifications-button";
import { useShell } from "./shell-context";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function Topbar() {
  const { setMobileNavOpen, setCommandOpen, basePath, can } = useShell();
  const apple = useIsApple();

  return (
    <header className="sticky top-0 z-(--z-index-sticky) flex h-(--topbar-h) shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 md:px-5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="min-w-0 flex-1">
        <AppBreadcrumbs />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setCommandOpen(true)}
        className="w-9 justify-center px-0 text-muted-foreground sm:w-56 sm:justify-start sm:px-2.5 lg:w-64"
        aria-label="Search and commands"
        aria-keyshortcuts={apple ? "Meta+K" : "Control+K"}
      >
        <Search />
        <span className="hidden flex-1 text-left font-normal sm:inline">Search or jump to…</span>
        <KbdGroup className="hidden sm:inline-flex">
          <Kbd>{apple ? "⌘" : "Ctrl"}</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </Button>

      <div className="flex items-center gap-1">
        {can("ai.copilot.use") ? (
          <SimpleTooltip label="AI Copilot">
            <Button variant="ai" size="sm" asChild className="hidden sm:inline-flex">
              <Link href={joinPath(basePath, "/copilot") as Route}>
                <Sparkles />
                Ask AI
              </Link>
            </Button>
          </SimpleTooltip>
        ) : null}
        <NotificationsButton />
        <ThemeToggle />
        <div className="ml-1">
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
