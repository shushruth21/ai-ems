"use client";

import type { Route } from "next";
import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { useState, useTransition } from "react";

import { FormFeedback } from "@/components/forms/form-feedback";
import type { FormFeedback as Feedback } from "@/lib/use-action-form";
import { Button } from "@ai-ems/ui/components/ui/button";
import { EmptyState } from "@ai-ems/ui/components/data/empty-state";

import { markAllRead, markRead } from "../actions";

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsInbox({
  slug,
  notifications,
}: {
  slug: string;
  notifications: NotificationView[];
}) {
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pending, startTransition] = useTransition();
  const unread = notifications.filter((n) => !n.readAt).length;

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="You're all caught up"
        description="Joins, role changes and security notices for this workspace land here."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {unread === 0 ? "Nothing unread." : `${unread} unread`}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || unread === 0}
          onClick={() =>
            startTransition(async () => {
              const result = await markAllRead(slug);
              setFeedback(
                result.ok
                  ? { tone: "success", message: result.message ?? "Done." }
                  : { tone: "danger", message: result.formError ?? "That didn't work." },
              );
            })
          }
        >
          <CheckCheck aria-hidden />
          Mark all read
        </Button>
      </div>

      <FormFeedback feedback={feedback} />

      <ul className="divide-y rounded-lg border" aria-label="Notifications">
        {notifications.map((notification) => (
          <li
            key={notification.id}
            className="flex flex-wrap items-start justify-between gap-2 px-3 py-3 data-[unread=true]:bg-surface"
            data-unread={!notification.readAt}
          >
            <div className="min-w-0">
              <p className="font-medium">
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
              <p className="text-xs text-muted-foreground">
                <time dateTime={notification.createdAt}>
                  {new Date(notification.createdAt).toLocaleString()}
                </time>
              </p>
            </div>
            {notification.readAt ? null : (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                aria-label={`Mark "${notification.title}" as read`}
                onClick={() =>
                  startTransition(async () => {
                    await markRead(slug, { notificationId: notification.id });
                  })
                }
              >
                Mark read
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
