"use client";

import { Bell, BellOff } from "lucide-react";

import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SimpleTooltip } from "@/components/ui/tooltip";

/** Notification inbox entry point. Data arrives with the Platform phase. */
export function NotificationsButton({ unread = 0 }: { unread?: number }) {
  const label = unread ? `Notifications, ${unread} unread` : "Notifications";
  return (
    <Popover>
      <SimpleTooltip label="Notifications">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={label} className="relative">
            <Bell />
            {unread ? (
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
        </div>
        <EmptyState
          size="sm"
          icon={BellOff}
          title="You're all caught up"
          description="Mentions, approvals and alerts will appear here."
        />
      </PopoverContent>
    </Popover>
  );
}
