"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SimpleTooltip } from "@/components/ui/tooltip";
import { findActiveItem, joinPath } from "@/config/navigation";
import { cn } from "@/lib/utils";

import { useShell } from "./shell-context";

export function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const { navigation, basePath } = useShell();
  const pathname = usePathname();
  const active = findActiveItem(navigation, pathname, basePath);

  return (
    <nav aria-label="Main" className="flex flex-col gap-4 px-2 py-3">
      {navigation.map((section) => (
        <div
          key={section.id}
          role="group"
          aria-labelledby={collapsed ? undefined : `nav-${section.id}`}
          aria-label={collapsed ? section.title : undefined}
        >
          {collapsed ? (
            <div className="mx-2 mb-1.5 h-px bg-sidebar-border first:hidden" aria-hidden />
          ) : (
            <h2
              id={`nav-${section.id}`}
              className="mb-1 px-2 text-2xs font-medium tracking-wide text-sidebar-muted uppercase"
            >
              {section.title}
            </h2>
          )}
          <ul className="flex flex-col gap-px">
            {section.items.map((item) => {
              const isActive = active?.id === item.id;
              const link = (
                <Link
                  href={joinPath(basePath, item.href) as Route}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group/nav flex h-8 items-center gap-2.5 rounded-md px-2 text-base text-sidebar-foreground outline-none",
                    "transition-colors duration-(--duration-fast) hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-ring",
                    isActive &&
                      "bg-sidebar-active font-medium text-sidebar-active-foreground hover:bg-sidebar-active",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive
                        ? "text-sidebar-active-foreground"
                        : "text-sidebar-muted group-hover/nav:text-sidebar-foreground",
                    )}
                    aria-hidden
                  />
                  {collapsed ? (
                    <span className="sr-only">{item.title}</span>
                  ) : (
                    <span className="truncate">{item.title}</span>
                  )}
                </Link>
              );
              return (
                <li key={item.id}>
                  {collapsed ? (
                    <SimpleTooltip
                      label={item.title}
                      side="right"
                      shortcut={item.shortcut ? `G ${item.shortcut.toUpperCase()}` : undefined}
                    >
                      {link}
                    </SimpleTooltip>
                  ) : (
                    link
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
