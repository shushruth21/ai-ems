"use client";

import { Bell, BellOff } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { joinPath } from "@/config/navigation";
import { EmptyState } from "@ai-ems/ui/components/data/empty-state";
import { Button } from "@ai-ems/ui/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@ai-ems/ui/components/ui/popover";
import { SimpleTooltip } from "@ai-ems/ui/components/ui/tooltip";

import { useShell } from "./shell-context";

/** The newest notifications, with the full inbox one click away. */
export function NotificationsButton() {
  const { basePath, notifications = [], unreadNotifications = 0 } = useShell();
  const label = unreadNotifications
    ? `Notifications, ${unreadNotifications} unread`
    : "Notifications";

  return (
    <Popover>
      <SimpleTooltip label="Notifications">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={label} className="relative">
            <Bell />
            {unreadNotifications ? (
              <span
                className="absolute top-1 right-1 size-2 rounded-full bg-danger ring-2 ring-background"
                aria-hidden
              />
            ) : null}
          </Button>
        </PopoverTrigger>
      </SimpleTooltip>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-base font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" asChild>
            <Link href={joinPath(basePath, "/notifications") as Route}>See all</Link>
          </Button>
        </div>
        {notifications.length === 0 ? (
          <EmptyState
            size="sm"
            icon={BellOff}
            title="You're all caught up"
            description="Mentions, approvals and alerts will appear here."
          />
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {notifications.map((notification) => (
              <li
                key={notification.id}
                className="px-3 py-2 data-[unread=true]:bg-surface"
                data-unread={!notification.read}
              >
                <p className="text-sm font-medium">
                  {notification.href ? (
                    <Link
                      className="underline-offset-4 hover:underline"
                      href={notification.href as Route}
                    >
                      {notification.title}
                    </Link>
                  ) : (
                    notification.title
                  )}
                </p>
                {notification.body ? (
                  <p className="text-sm text-muted-foreground">{notification.body}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
