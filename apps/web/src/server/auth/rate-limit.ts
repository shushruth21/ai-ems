import "server-only";

import { authSettings } from "@ai-ems/config/env";
import { env } from "@ai-ems/config/env.server";
import { logger } from "@ai-ems/observability/logger";
import {
  authRateLimitKeys,
  MemoryRateLimitStore,
  RateLimiter,
  type AuthAction,
  type RateLimitDecision,
  type RateLimitStore,
} from "@ai-ems/security/authentication/rate-limit";

import { identityKey } from "./audit";
import { getRequestMeta } from "./request-meta";

const globalForLimiter = globalThis as unknown as { authRateLimiter?: RateLimiter };

async function createStore(): Promise<RateLimitStore> {
  if (authSettings(env()).rateLimitStore === "memory") return new MemoryRateLimitStore();
  const [{ prisma }, { PostgresRateLimitStore }] = await Promise.all([
    import("@ai-ems/db/client"),
    import("@ai-ems/db/auth/rate-limit-store"),
  ]);
  return new PostgresRateLimitStore(<Row>(sql: string, params: unknown[]) =>
    prisma.$queryRawUnsafe<Row[]>(sql, ...params),
  );
}

async function limiter(): Promise<RateLimiter> {
  globalForLimiter.authRateLimiter ??= new RateLimiter(await createStore());
  return globalForLimiter.authRateLimiter;
}

const ALLOW: RateLimitDecision = {
  allowed: true,
  remaining: Number.POSITIVE_INFINITY,
  retryAfterSeconds: 0,
};

/**
 * Counts an attempt for `action` against both the client IP and the target
 * identity (email or user id). Fails open if the store is unavailable —
 * Supabase Auth enforces its own limits behind this one — and logs the failure.
 */
export async function limitAuthAttempt(
  action: AuthAction,
  identity: string,
): Promise<RateLimitDecision> {
  if (!authSettings(env()).rateLimitEnabled) return ALLOW;
  const { ip } = await getRequestMeta();
  const id = identity.includes("@") ? identityKey(identity) : identity;
  try {
    return await (await limiter()).consumeAll(authRateLimitKeys(action, ip, id));
  } catch (error) {
    logger.error("auth.rate_limit_unavailable", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
    return ALLOW;
  }
}
