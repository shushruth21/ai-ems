import type { ActorType, Prisma } from "../generated/prisma/client";

import type { DbOrTx } from "./types";

export interface AuditInput {
  organizationId: string;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
}

/** Appends to the tenant audit trail (append-only by trigger). */
export async function recordAudit(db: DbOrTx, input: AuditInput): Promise<void> {
  await db.auditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorType: input.actorId ? "USER" : "SYSTEM",
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ...(input.changes === undefined ? {} : { changes: input.changes }),
      ip: input.ip ?? null,
      userAgent: input.userAgent ? input.userAgent.slice(0, 512) : null,
    },
  });
}

export interface AuditFilters {
  action?: string;
  entityType?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
}

export interface AuditRow {
  id: string;
  actorType: ActorType;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes: Prisma.JsonValue | null;
  ip: string | null;
  createdAt: Date;
}

export interface AuditPage {
  rows: AuditRow[];
  /** Pass back as `cursor` for the next page; null when the list is exhausted. */
  nextCursor: string | null;
}

/** Distinct actions seen in this workspace, for the filter dropdown. */
export async function listAuditActions(db: DbOrTx, organizationId: string): Promise<string[]> {
  const rows = await db.auditEvent.findMany({
    where: { organizationId },
    distinct: ["action"],
    select: { action: true },
    orderBy: { action: "asc" },
    take: 100,
  });
  return rows.map((r) => r.action);
}

/**
 * Newest first, keyset-paginated on the bigint id (stable while new rows
 * arrive). `limit` is clamped; one extra row is read to detect more pages.
 */
export async function listAuditEvents(
  db: DbOrTx,
  organizationId: string,
  filters: AuditFilters = {},
  options: { cursor?: string; limit?: number } = {},
): Promise<AuditPage> {
  const take = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const rows = await db.auditEvent.findMany({
    where: {
      organizationId,
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lt: filters.to } : {}),
            },
          }
        : {}),
      ...(options.cursor ? { id: { lt: BigInt(options.cursor) } } : {}),
    },
    orderBy: { id: "desc" },
    take: take + 1,
    select: {
      id: true,
      actorType: true,
      actorId: true,
      action: true,
      entityType: true,
      entityId: true,
      changes: true,
      ip: true,
      createdAt: true,
    },
  });
  const page = rows.slice(0, take);
  const actorIds = [...new Set(page.map((r) => r.actorId).filter((id): id is string => !!id))];
  const actors = actorIds.length
    ? await db.profile.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, fullName: true, email: true },
      })
    : [];
  const names = new Map(actors.map((a) => [a.id, a.fullName ?? a.email]));
  return {
    rows: page.map((r) => ({
      ...r,
      id: r.id.toString(),
      actorName: r.actorId ? (names.get(r.actorId) ?? null) : null,
    })),
    nextCursor: rows.length > take ? page[page.length - 1]!.id.toString() : null,
  };
}
