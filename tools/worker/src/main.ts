/**
 * Outbox worker.
 *
 *   pnpm --filter @ai-ems/worker start
 *
 * Drains `outbox_events` into in-app notifications and email. Safe to run in
 * several copies: claiming uses `FOR UPDATE SKIP LOCKED`. Stops cleanly on
 * SIGINT/SIGTERM, finishing the batch in flight.
 */
import { createServer, type Server } from "node:http";

import { parseServerEnv, mailSettings } from "@ai-ems/config/env";
import { PrismaClient } from "@ai-ems/db/generated/client";
import { outboxStats } from "@ai-ems/db/platform/outbox";
import { createMailer } from "@ai-ems/mail/mailer";
import { logger } from "@ai-ems/observability/logger";
import { PrismaPg } from "@prisma/adapter-pg";

import { runLoop } from "./runner";

/** Optional probe endpoint: GET /healthz reports the queue's shape. */
function healthServer(db: PrismaClient, port: number): Server {
  return createServer((request, response) => {
    if (request.url?.split("?")[0] !== "/healthz") {
      response.writeHead(404).end();
      return;
    }
    outboxStats(db)
      .then((queue) => {
        response
          .writeHead(200, { "content-type": "application/json", "cache-control": "no-store" })
          .end(JSON.stringify({ status: "ok", queue }));
      })
      .catch(() => {
        response
          .writeHead(503, { "content-type": "application/json" })
          .end('{"status":"degraded"}');
      });
  }).listen(port);
}

async function main(): Promise<void> {
  const env = parseServerEnv();
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: ["error"],
  });
  const mailer = createMailer(mailSettings(env));
  const controller = new AbortController();
  const health = env.WORKER_HEALTH_PORT ? healthServer(db, env.WORKER_HEALTH_PORT) : null;

  let stopping = false;
  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    logger.info("worker.stopping", { signal });
    controller.abort();
    health?.close();
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  logger.info("worker.started", {
    pollMs: env.WORKER_POLL_MS,
    batchSize: env.WORKER_BATCH_SIZE,
    mail: mailer.transport,
    ...(env.WORKER_HEALTH_PORT ? { healthPort: env.WORKER_HEALTH_PORT } : {}),
  });

  try {
    await runLoop({
      db,
      mailer,
      appUrl: env.NEXT_PUBLIC_APP_URL,
      batchSize: env.WORKER_BATCH_SIZE,
      pollMs: env.WORKER_POLL_MS,
      signal: controller.signal,
    });
  } finally {
    health?.close();
    await db.$disconnect();
    logger.info("worker.stopped");
  }
}

main().catch((error: unknown) => {
  logger.error("worker.crashed", {
    error: error instanceof Error ? error.stack : String(error),
  });
  process.exit(1);
});
