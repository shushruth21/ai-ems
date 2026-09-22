import type { Prisma } from "../generated/prisma/client";

import type { Db, DbOrTx } from "./types";

/**
 * Transactional outbox. Events are written in the same transaction as the
 * change that caused them, then picked up by the worker (tools/worker), so a
 * crash can never lose an event or send it without the data being committed.
 */
export interface OutboxInput {
  organizationId: string;
  type: string;
  payload: Prisma.InputJsonValue;
  /** Delay before the event becomes visible to the worker. */
  availableAt?: Date;
}

export interface OutboxJob {
  id: string;
  organizationId: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
}

export const MAX_ATTEMPTS = 8;

export async function enqueueOutbox(db: DbOrTx, inputs: OutboxInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const { count } = await db.outboxEvent.createMany({
    data: inputs.map((e) => ({
      organizationId: e.organizationId,
      type: e.type,
      payload: e.payload,
      ...(e.availableAt ? { availableAt: e.availableAt } : {}),
    })),
  });
  return count;
}

/**
 * Atomically claims a batch for this worker. `FOR UPDATE SKIP LOCKED` lets
 * several workers run without handing the same event to two of them.
 */
export async function claimOutboxBatch(db: Db, limit = 20): Promise<OutboxJob[]> {
  const rows = await db.$queryRaw<
    Array<{
      id: bigint;
      organization_id: string;
      type: string;
      payload: Prisma.JsonValue;
      attempts: number;
    }>
  >`
    update public.outbox_events
       set status = 'PROCESSING', attempts = attempts + 1, available_at = now()
     where id in (
       select id from public.outbox_events
        where status = 'PENDING' and available_at <= now()
        order by available_at, id
        limit ${limit}
        for update skip locked
     )
    returning id, organization_id, type, payload, attempts`;
  return rows.map((r) => ({
    id: r.id.toString(),
    organizationId: r.organization_id,
    type: r.type,
    payload: r.payload,
    attempts: r.attempts,
  }));
}

export async function completeOutbox(db: Db, id: string): Promise<void> {
  await db.outboxEvent.update({
    where: { id: BigInt(id) },
    data: { status: "DONE", lastError: null },
  });
}

/** Exponential backoff: ~10s, 20s, 40s … then park the event as FAILED. */
export function retryDelayMs(attempts: number): number {
  return Math.min(10_000 * 2 ** Math.max(0, attempts - 1), 60 * 60 * 1000);
}

export async function failOutbox(
  db: Db,
  job: OutboxJob,
  error: unknown,
): Promise<"retry" | "dead"> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 1000);
  const dead = job.attempts >= MAX_ATTEMPTS;
  await db.outboxEvent.update({
    where: { id: BigInt(job.id) },
    data: dead
      ? { status: "FAILED", lastError: message }
      : {
          status: "PENDING",
          lastError: message,
          availableAt: new Date(Date.now() + retryDelayMs(job.attempts)),
        },
  });
  return dead ? "dead" : "retry";
}

/**
 * Events stuck in PROCESSING (the worker crashed mid-flight) become claimable
 * again. Claiming stamps `available_at`, so this measures time since the claim.
 */
export async function requeueStuckOutbox(db: Db, olderThanMs = 5 * 60_000): Promise<number> {
  const { count } = await db.outboxEvent.updateMany({
    where: { status: "PROCESSING", availableAt: { lt: new Date(Date.now() - olderThanMs) } },
    data: { status: "PENDING" },
  });
  return count;
}

export async function outboxStats(db: Db): Promise<Record<string, number>> {
  const rows = await db.outboxEvent.groupBy({ by: ["status"], _count: { _all: true } });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
}
