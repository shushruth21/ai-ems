import type { RateLimitStore } from "@ai-ems/security/authentication/rate-limit";

/** Minimal SQL runner so the store works with Prisma ($queryRawUnsafe) and node-postgres alike. */
export type SqlRunner = <Row>(sql: string, params: unknown[]) => Promise<Row[]>;

// Timestamps are passed and returned as UTC epoch milliseconds to avoid
// driver/timezone ambiguity with `timestamp without time zone` columns.
const HIT_SQL = `
insert into public.rate_limit_buckets as b (key, count, window_start, expires_at)
values (
  $1, 1,
  to_timestamp($2::float8 / 1000) at time zone 'utc',
  to_timestamp(($2::float8 + $3::float8 * 1000) / 1000) at time zone 'utc'
)
on conflict (key) do update set
  count        = case when b.expires_at <= excluded.window_start then 1 else b.count + 1 end,
  window_start = case when b.expires_at <= excluded.window_start then excluded.window_start else b.window_start end,
  expires_at   = case when b.expires_at <= excluded.window_start then excluded.expires_at else b.expires_at end
returning b.count::int as count, (extract(epoch from b.expires_at) * 1000)::float8 as reset_ms`;

const PURGE_SQL = `delete from public.rate_limit_buckets where expires_at < to_timestamp($1::float8 / 1000) at time zone 'utc'`;

export interface PostgresRateLimitStoreOptions {
  /** Probability (0–1) that a hit also purges expired buckets. */
  purgeProbability?: number;
  random?: () => number;
}

/** Shared, atomic fixed-window counters in Postgres (one upsert per hit). */
export class PostgresRateLimitStore implements RateLimitStore {
  private readonly purgeProbability: number;
  private readonly random: () => number;

  constructor(
    private readonly run: SqlRunner,
    options: PostgresRateLimitStoreOptions = {},
  ) {
    this.purgeProbability = options.purgeProbability ?? 0.01;
    this.random = options.random ?? Math.random;
  }

  async hit(key: string, windowSeconds: number, now: Date) {
    const rows = await this.run<{ count: number; reset_ms: number }>(HIT_SQL, [
      key,
      now.getTime(),
      windowSeconds,
    ]);
    const row = rows[0];
    if (!row) throw new Error("rate limit upsert returned no row");
    if (this.random() < this.purgeProbability) {
      // Best effort; never fail the request because housekeeping failed.
      await this.run(PURGE_SQL, [now.getTime() - 3_600_000]).catch(() => undefined);
    }
    return { count: Number(row.count), resetAt: new Date(Number(row.reset_ms)) };
  }

  async reset(key: string) {
    await this.run("delete from public.rate_limit_buckets where key = $1", [key]);
  }
}
