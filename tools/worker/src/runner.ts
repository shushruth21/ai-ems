import { logger } from "@ai-ems/observability/logger";
import type { Mailer } from "@ai-ems/mail/mailer";

import { createNotifications } from "@ai-ems/db/platform/notifications";
import {
  claimOutboxBatch,
  completeOutbox,
  failOutbox,
  requeueStuckOutbox,
  type OutboxJob,
} from "@ai-ems/db/platform/outbox";
import type { Db } from "@ai-ems/db/platform/types";

import { handlers, type HandlerContext, type NotificationDraft } from "./handlers";

export interface RunnerOptions {
  db: Db;
  mailer: Mailer;
  /** Absolute base for links in notifications and email. */
  appUrl: string;
  batchSize?: number;
  /** Events left PROCESSING for longer than this are assumed abandoned. */
  stuckAfterMs?: number;
}

export interface BatchResult {
  claimed: number;
  done: number;
  retried: number;
  dead: number;
  skipped: number;
  notifications: number;
}

const EMPTY: BatchResult = {
  claimed: 0,
  done: 0,
  retried: 0,
  dead: 0,
  skipped: 0,
  notifications: 0,
};

function asRecord(payload: unknown): Record<string, unknown> {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : {};
}

/** Lookups a handler may need, memoised per event so one event hits the db once. */
function contextFor(options: RunnerOptions, job: OutboxJob): HandlerContext {
  const { db, mailer, appUrl } = options;
  const base = appUrl.replace(/\/+$/, "");
  let organization: Promise<{ name: string; slug: string }> | undefined;
  const profiles = new Map<string, Promise<{ email: string; fullName: string | null } | null>>();

  return {
    organizationId: job.organizationId,
    payload: asRecord(job.payload),
    appUrl: (path) => `${base}${path.startsWith("/") ? path : `/${path}`}`,
    mailer,
    async organization() {
      organization ??= db.organization
        .findUniqueOrThrow({
          where: { id: job.organizationId },
          select: { name: true, slug: true },
        })
        .then((o) => o);
      return organization;
    },
    async profile(profileId) {
      let found = profiles.get(profileId);
      if (!found) {
        found = db.profile.findUnique({
          where: { id: profileId },
          select: { email: true, fullName: true },
        });
        profiles.set(profileId, found);
      }
      return found;
    },
    async recipientsWithPermission(permissionKey) {
      const rows = await db.membership.findMany({
        where: {
          organizationId: job.organizationId,
          status: "ACTIVE",
          role: { permissions: { some: { permissionKey } } },
        },
        select: { profileId: true, profile: { select: { email: true } } },
      });
      return rows.map((r) => ({ profileId: r.profileId, email: r.profile.email }));
    },
  };
}

/** Runs one event: handler → in-app notifications → email. */
export async function handleJob(
  options: RunnerOptions,
  job: OutboxJob,
): Promise<{ drafts: NotificationDraft[] }> {
  const handler = handlers[job.type];
  if (!handler) throw new Error(`No handler for outbox event "${job.type}"`);
  const drafts = await handler(contextFor(options, job));

  await createNotifications(
    options.db,
    drafts.map((d) => ({
      organizationId: job.organizationId,
      recipientId: d.recipientId,
      type: d.type,
      title: d.title,
      body: d.body ?? null,
      href: d.href ?? null,
      entityType: d.entityType ?? null,
      entityId: d.entityId ?? null,
    })),
  );

  // Email is best-effort: `send()` never throws, and a bounced message must not
  // re-run the handler (which would duplicate the in-app notification).
  for (const draft of drafts) {
    if (draft.email) await options.mailer.send(draft.email);
  }
  return { drafts };
}

/**
 * Claims and processes one batch. Never throws for a single bad event: the
 * event is retried with backoff and parked as FAILED once attempts run out.
 */
export async function runBatch(options: RunnerOptions): Promise<BatchResult> {
  const { db } = options;
  const requeued = await requeueStuckOutbox(db, options.stuckAfterMs);
  if (requeued > 0) logger.warn("outbox.requeued_stuck", { count: requeued });

  const jobs = await claimOutboxBatch(db, options.batchSize ?? 20);
  if (jobs.length === 0) return EMPTY;

  const result: BatchResult = { ...EMPTY, claimed: jobs.length };
  for (const job of jobs) {
    try {
      if (!(job.type in handlers)) {
        // Unknown types are a deploy-order problem, not data loss: mark them
        // done so the queue drains, and make the gap visible in the logs.
        logger.warn("outbox.unknown_event", { type: job.type, id: job.id });
        await completeOutbox(db, job.id);
        result.skipped += 1;
        continue;
      }
      const { drafts } = await handleJob(options, job);
      await completeOutbox(db, job.id);
      result.done += 1;
      result.notifications += drafts.length;
    } catch (error) {
      const outcome = await failOutbox(db, job, error);
      result[outcome === "dead" ? "dead" : "retried"] += 1;
      logger.error("outbox.event_failed", {
        id: job.id,
        type: job.type,
        attempts: job.attempts,
        outcome,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}

export interface LoopOptions extends RunnerOptions {
  pollMs: number;
  signal: AbortSignal;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

/** Polls until the signal aborts. A failing batch backs off instead of spinning. */
export async function runLoop(options: LoopOptions): Promise<void> {
  const { pollMs, signal } = options;
  let idleFailures = 0;
  while (!signal.aborted) {
    try {
      const result = await runBatch(options);
      idleFailures = 0;
      if (result.claimed > 0) logger.info("outbox.batch", { ...result });
      // Drain a full batch immediately; only idle when there is nothing left.
      if (result.claimed >= (options.batchSize ?? 20)) continue;
    } catch (error) {
      idleFailures = Math.min(idleFailures + 1, 5);
      logger.error("outbox.batch_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await sleep(pollMs * (idleFailures > 0 ? 2 ** idleFailures : 1), signal);
  }
}
