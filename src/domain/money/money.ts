/**
 * Exact money arithmetic using integer minor units (cents) stored as bigint.
 * Never use JS floats for currency.
 */
export type Minor = bigint;

const SCALE = 100n;

/** Parse "1234.5" | 1234.5 | "−1,234.56" into minor units (half-up rounding). */
export function toMinor(value: string | number): Minor {
  const raw = typeof value === "number" ? value.toFixed(6) : value.replace(/,/g, "").trim();
  if (!/^[-+]?\d*(\.\d*)?$/.test(raw) || raw === "" || raw === ".") {
    throw new RangeError(`Invalid money amount: ${String(value)}`);
  }
  const negative = raw.startsWith("-");
  const [intPart = "0", fracPart = ""] = raw.replace(/^[-+]/, "").split(".");
  const frac = (fracPart + "000").slice(0, 3);
  let minor = BigInt(intPart || "0") * SCALE + BigInt(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) minor += 1n;
  return negative ? -minor : minor;
}

export function fromMinor(minor: Minor): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const str = `${abs / SCALE}.${(abs % SCALE).toString().padStart(2, "0")}`;
  return negative ? `-${str}` : str;
}

/** Multiply minor units by a decimal factor (quantity, percentage) with half-up rounding. */
export function multiply(minor: Minor, factor: string | number, factorScale = 6): Minor {
  const f = typeof factor === "number" ? factor.toFixed(factorScale) : factor;
  const [i = "0", d = ""] = f.replace(/^[-+]/, "").split(".");
  const digits = (d + "0".repeat(factorScale)).slice(0, factorScale);
  const scaled = BigInt(i + digits) * (f.startsWith("-") ? -1n : 1n);
  const divisor = 10n ** BigInt(factorScale);
  const product = minor * scaled;
  const q = product / divisor;
  const r = product % divisor;
  const absR = r < 0n ? -r : r;
  if (absR * 2n >= divisor) return product < 0n ? q - 1n : q + 1n;
  return q;
}

export function percentOf(minor: Minor, pct: string | number): Minor {
  const p = typeof pct === "number" ? pct : Number(pct);
  return multiply(minor, (p / 100).toFixed(8), 8);
}

export function sum(values: readonly Minor[]): Minor {
  return values.reduce((acc, v) => acc + v, 0n);
}

export function formatMoney(minor: Minor, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    Number(fromMinor(minor)),
  );
}
