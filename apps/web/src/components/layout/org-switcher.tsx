"use client";

import type { Route } from "next";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ai-ems/ui/components/ui/dropdown-menu";
import { cn } from "@ai-ems/ui/lib/utils";
import type { ShellOrganization } from "@/types/shell";

import { useShell } from "./shell-context";

function OrgAvatar({ org, className }: { org: ShellOrganization; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground",
        className,
      )}
    >
      {org.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function planLabel(plan: ShellOrganization["plan"]): string {
  return `${plan.charAt(0)}${plan.slice(1).toLowerCase()} plan`;
}

/** Replaces the org slug segment in the current base path. */
export function switchOrgPath(basePath: string, fromSlug: string, toSlug: string): string {
  const parts = basePath.split("/");
  const idx = parts.lastIndexOf(fromSlug);
  if (idx === -1) return `/${toSlug}`;
  parts[idx] = toSlug;
  return parts.join("/");
}

export function OrgSwitcher() {
  const { organization, organizations, basePath, collapsed } = useShell();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-md px-1.5 text-left outline-none",
          "hover:bg-sidebar-hover focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-sidebar-hover",
          collapsed && "justify-center px-0",
        )}
        aria-label={`Organization: ${organization.name}. Switch organization`}
      >
        <OrgAvatar org={organization} />
        {collapsed ? null : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-sidebar-foreground">
                {organization.name}
              </span>
              <span className="block truncate text-2xs text-sidebar-muted">
                {planLabel(organization.plan)}
              </span>
            </span>
            <ChevronsUpDown className="size-4 text-sidebar-muted" aria-hidden />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Organizations</DropdownMenuLabel>
        {organizations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onSelect={() => {
              if (org.slug !== organization.slug) {
                router.push(
                  `${switchOrgPath(basePath, organization.slug, org.slug)}/dashboard` as Route,
                );
              }
            }}
          >
            <OrgAvatar org={org} className="size-5 text-2xs" />
            <span className="flex-1 truncate">{org.name}</span>
            {org.slug === organization.slug ? (
              <Check className="text-foreground!" aria-label="Current" />
            ) : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <Plus />
          Create organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
