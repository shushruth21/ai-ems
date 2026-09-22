import type { Prisma } from "../generated/prisma/client";

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
