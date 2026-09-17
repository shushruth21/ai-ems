/**
 * Locale-aware display formatting. Pure functions; all values are formatted
 * with Intl and cached formatters. Never use these for arithmetic.
 */
type Numeric = number | string | bigint;

const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>();

function memo<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(
  key: string,
  create: () => T,
): T {
  let f = cache.get(key) as T | undefined;
  if (!f) {
    f = create();
    cache.set(key, f);
  }
  return f;
}

function toNumber(value: Numeric): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

export const EMPTY = "—";

export function formatNumber(
  value: Numeric | null | undefined,
  opts: Intl.NumberFormatOptions = {},
  locale = "en-US",
): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  const n = toNumber(value);
  if (Number.isNaN(n)) return EMPTY;
  const f = memo(`n|${locale}|${JSON.stringify(opts)}`, () => new Intl.NumberFormat(locale, opts));
  return (f as Intl.NumberFormat).format(n);
}

export function formatCurrency(
  value: Numeric | null | undefined,
  currency = "USD",
  { compact = false, locale = "en-US" }: { compact?: boolean; locale?: string } = {},
): string {
  return formatNumber(
    value,
    compact
      ? { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }
      : { style: "currency", currency },
    locale,
  );
}

/** 1284 → "1,284", 12_900 → "12.9K", 4_200_000 → "4.2M" */
export function formatCompact(value: Numeric | null | undefined, locale = "en-US"): string {
  const n = toNumber(value ?? Number.NaN);
  if (Number.isNaN(n)) return EMPTY;
  if (Math.abs(n) < 10_000) return formatNumber(n, { maximumFractionDigits: 0 }, locale);
  return formatNumber(n, { notation: "compact", maximumFractionDigits: 1 }, locale);
}

/** `ratio` is a fraction: 0.125 → "12.5%". */
export function formatPercent(
  ratio: Numeric | null | undefined,
  digits = 1,
  locale = "en-US",
): string {
  return formatNumber(
    ratio,
    { style: "percent", maximumFractionDigits: digits, minimumFractionDigits: 0 },
    locale,
  );
}

/** Signed change: +12.5% / −3% / 0% */
export function formatDelta(ratio: number, digits = 1, locale = "en-US"): string {
  if (!Number.isFinite(ratio)) return EMPTY;
  const body = formatPercent(Math.abs(ratio), digits, locale);
  if (ratio > 0) return `+${body}`;
  if (ratio < 0) return `−${body}`;
  return body;
}

export function formatDate(
  value: Date | string | number | null | undefined,
  style: "short" | "medium" | "long" | "datetime" | "time" = "medium",
  { locale = "en-US", timeZone }: { locale?: string; timeZone?: string } = {},
): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY;
  const options: Record<typeof style, Intl.DateTimeFormatOptions> = {
    short: { month: "short", day: "numeric" },
    medium: { month: "short", day: "numeric", year: "numeric" },
    long: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
    datetime: {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
    time: { hour: "numeric", minute: "2-digit" },
  };
  const f = memo(
    `d|${locale}|${style}|${timeZone ?? ""}`,
    () => new Intl.DateTimeFormat(locale, { ...options[style], timeZone }),
  );
  return (f as Intl.DateTimeFormat).format(d);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
  ["second", 1],
];

/** "3 hours ago", "in 2 days", "just now" */
export function formatRelativeTime(
  value: Date | string | number,
  now: Date = new Date(),
  locale = "en-US",
): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return EMPTY;
  const diffSec = Math.round((d.getTime() - now.getTime()) / 1000);
  if (Math.abs(diffSec) < 45) return "just now";
  const f = memo(
    `r|${locale}`,
    () => new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
  ) as Intl.RelativeTimeFormat;
  for (const [unit, secs] of UNITS) {
    if (Math.abs(diffSec) >= secs || unit === "second") {
      return f.format(Math.round(diffSec / secs), unit);
    }
  }
  return EMPTY;
}
