/**
 * Fixed-window rate limiting for authentication endpoints.
 * The in-memory store suits tests and single-instance dev; production uses the
 * Postgres store in @ai-ems/db so limits hold across serverless instances.
 */
export interface RateLimitRule {
  /** Maximum attempts inside one window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets (0 when allowed and fresh). */
  retryAfterSeconds: number;
}

export interface RateLimitStore {
  /** Atomically increments the counter for `key` and returns the new count and window reset time. */
  hit(key: string, windowSeconds: number, now: Date): Promise<{ count: number; resetAt: Date }>;
  reset(key: string): Promise<void>;
}

export type AuthAction =
  "sign-in" | "magic-link" | "sign-up" | "password-reset" | "mfa-verify" | "password-change";

/**
 * Per-action rules. Keys combine the action with both the client IP and the
 * target identity so one attacker can't lock out a victim from everywhere,
 * and a botnet can't spray one account.
 */
export const AUTH_RATE_LIMITS: Record<
  AuthAction,
  { perIp: RateLimitRule; perIdentity: RateLimitRule }
> = {
  "sign-in": {
    perIp: { limit: 30, windowSeconds: 600 },
    perIdentity: { limit: 10, windowSeconds: 600 },
  },
  "magic-link": {
    perIp: { limit: 10, windowSeconds: 600 },
    perIdentity: { limit: 3, windowSeconds: 600 },
  },
  "sign-up": {
    perIp: { limit: 10, windowSeconds: 3600 },
    perIdentity: { limit: 3, windowSeconds: 3600 },
  },
  "password-reset": {
    perIp: { limit: 10, windowSeconds: 3600 },
    perIdentity: { limit: 3, windowSeconds: 3600 },
  },
  "mfa-verify": {
    perIp: { limit: 30, windowSeconds: 600 },
    perIdentity: { limit: 8, windowSeconds: 600 },
  },
  "password-change": {
    perIp: { limit: 20, windowSeconds: 3600 },
    perIdentity: { limit: 5, windowSeconds: 3600 },
  },
};

export class RateLimiter {
  constructor(
    private readonly store: RateLimitStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async consume(key: string, rule: RateLimitRule): Promise<RateLimitDecision> {
    const now = this.clock();
    const { count, resetAt } = await this.store.hit(key, rule.windowSeconds, now);
    const retryAfterSeconds = Math.max(0, Math.ceil((resetAt.getTime() - now.getTime()) / 1000));
    if (count > rule.limit) return { allowed: false, remaining: 0, retryAfterSeconds };
    return { allowed: true, remaining: rule.limit - count, retryAfterSeconds: 0 };
  }

  /**
   * Consumes every key; denied if any is exhausted. All keys are hit so
   * attempts are counted even when an earlier key already denies.
   */
  async consumeAll(
    entries: ReadonlyArray<{ key: string; rule: RateLimitRule }>,
  ): Promise<RateLimitDecision> {
    const decisions = await Promise.all(entries.map((e) => this.consume(e.key, e.rule)));
    const denied = decisions.filter((d) => !d.allowed);
    if (denied.length > 0) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(...denied.map((d) => d.retryAfterSeconds)),
      };
    }
    return {
      allowed: true,
      remaining: Math.min(...decisions.map((d) => d.remaining)),
      retryAfterSeconds: 0,
    };
  }

  reset(key: string): Promise<void> {
    return this.store.reset(key);
  }
}

export function authRateLimitKeys(action: AuthAction, ip: string, identity: string) {
  const rules = AUTH_RATE_LIMITS[action];
  return [
    { key: `auth:${action}:ip:${ip}`, rule: rules.perIp },
    { key: `auth:${action}:id:${identity}`, rule: rules.perIdentity },
  ];
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: Date }>();

  hit(key: string, windowSeconds: number, now: Date) {
    const current = this.buckets.get(key);
    if (!current || current.resetAt.getTime() <= now.getTime()) {
      const fresh = { count: 1, resetAt: new Date(now.getTime() + windowSeconds * 1000) };
      this.buckets.set(key, fresh);
      return Promise.resolve({ ...fresh });
    }
    current.count += 1;
    return Promise.resolve({ ...current });
  }

  reset(key: string) {
    this.buckets.delete(key);
    return Promise.resolve();
  }
}
