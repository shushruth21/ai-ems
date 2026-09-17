import {
  EMPTY,
  formatCompact,
  formatCurrency,
  formatDate,
  formatDelta,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from "./format";

describe("format", () => {
  it("formats numbers and handles empty input", () => {
    expect(formatNumber(1234.5)).toBe("1,234.5");
    expect(formatNumber("42")).toBe("42");
    expect(formatNumber(null)).toBe(EMPTY);
    expect(formatNumber("abc")).toBe(EMPTY);
  });

  it("formats currency, optionally compact", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
    expect(formatCurrency("712400", "USD", { compact: true })).toBe("$712.4K");
    expect(formatCurrency(10, "EUR", { locale: "de-DE" }).replace(/\s/g, " ")).toBe("10,00 €");
  });

  it("compacts only large numbers", () => {
    expect(formatCompact(1284)).toBe("1,284");
    expect(formatCompact(12_900)).toBe("12.9K");
    expect(formatCompact(4_200_000)).toBe("4.2M");
    expect(formatCompact(undefined)).toBe(EMPTY);
  });

  it("formats percentages and signed deltas", () => {
    expect(formatPercent(0.125)).toBe("12.5%");
    expect(formatPercent(0.934, 0)).toBe("93%");
    expect(formatDelta(0.124)).toBe("+12.4%");
    expect(formatDelta(-0.021)).toBe("−2.1%");
    expect(formatDelta(0)).toBe("0%");
    expect(formatDelta(Number.NaN)).toBe(EMPTY);
  });

  it("formats dates in a fixed time zone", () => {
    const d = "2026-09-17T15:30:00Z";
    expect(formatDate(d, "medium", { timeZone: "UTC" })).toBe("Sep 17, 2026");
    expect(formatDate(d, "short", { timeZone: "UTC" })).toBe("Sep 17");
    expect(formatDate(d, "time", { timeZone: "UTC" })).toBe("3:30 PM");
    expect(formatDate("not a date")).toBe(EMPTY);
    expect(formatDate(null)).toBe(EMPTY);
  });

  it("formats relative time", () => {
    const now = new Date("2026-09-17T12:00:00Z");
    expect(formatRelativeTime(new Date("2026-09-17T11:59:40Z"), now)).toBe("just now");
    expect(formatRelativeTime(new Date("2026-09-17T09:00:00Z"), now)).toBe("3 hours ago");
    expect(formatRelativeTime(new Date("2026-09-19T12:00:00Z"), now)).toBe("in 2 days");
    expect(formatRelativeTime(new Date("2026-09-16T12:00:00Z"), now)).toBe("yesterday");
    expect(formatRelativeTime("bad", now)).toBe(EMPTY);
  });
});
