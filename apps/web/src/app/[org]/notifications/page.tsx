import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-container";
import { NotificationsInbox } from "@/features/platform/components/notifications-inbox";
import { requireOrgContext } from "@/server/org/context";
import { PageHeader } from "@ai-ems/ui/components/data/page-header";
import { prisma } from "@ai-ems/db/client";
import { listNotifications } from "@ai-ems/db/platform/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ params }: PageProps<"/[org]/notifications">) {
  const { org } = await params;
  const ctx = await requireOrgContext(org);
  const notifications = await listNotifications(prisma, ctx.organization.id, ctx.user.id, {
    limit: 50,
  });

  return (
    <PageContainer>
      <PageHeader title="Notifications" description="What happened in this workspace." />
      <NotificationsInbox
        slug={org}
        notifications={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          href: n.href,
          readAt: n.readAt?.toISOString() ?? null,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </PageContainer>
  );
}
