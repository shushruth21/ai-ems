import { recordAudit } from "./audit";
import type { Db, DbOrTx } from "./types";

export interface NotificationInput {
  organizationId: string;
  recipientId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/** In-app notifications. Delivery to email happens through the outbox worker. */
export async function createNotifications(
  db: DbOrTx,
  inputs: NotificationInput[],
): Promise<number> {
  if (inputs.length === 0) return 0;
  const { count } = await db.notification.createMany({
    data: inputs.map((n) => ({
      organizationId: n.organizationId,
      recipientId: n.recipientId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      href: n.href ?? null,
      entityType: n.entityType ?? null,
      entityId: n.entityId ?? null,
    })),
  });
  return count;
}

export async function listNotifications(
  db: DbOrTx,
  organizationId: string,
  recipientId: string,
  options: { limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationRow[]> {
  return db.notification.findMany({
    where: {
      organizationId,
      recipientId,
      ...(options.unreadOnly ? { readAt: null } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(options.limit ?? 30, 1), 100),
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function countUnread(
  db: DbOrTx,
  organizationId: string,
  recipientId: string,
): Promise<number> {
  return db.notification.count({ where: { organizationId, recipientId, readAt: null } });
}

/** Marks one notification read. Scoped to the recipient, so ids can't be guessed across users. */
export async function markNotificationRead(
  db: DbOrTx,
  organizationId: string,
  recipientId: string,
  notificationId: string,
  read = true,
): Promise<boolean> {
  const { count } = await db.notification.updateMany({
    where: { id: notificationId, organizationId, recipientId },
    data: { readAt: read ? new Date() : null },
  });
  return count > 0;
}

export async function markAllNotificationsRead(
  db: DbOrTx,
  organizationId: string,
  recipientId: string,
): Promise<number> {
  const { count } = await db.notification.updateMany({
    where: { organizationId, recipientId, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}

/** Recipients for workspace-wide security notices: every active member holding a permission. */
export async function recipientsWithPermission(
  db: Db,
  organizationId: string,
  permissionKey: string,
): Promise<string[]> {
  const rows = await db.membership.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      role: { permissions: { some: { permissionKey } } },
    },
    select: { profileId: true },
  });
  return rows.map((r) => r.profileId);
}

export { recordAudit };
