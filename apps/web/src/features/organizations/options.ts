import "server-only";

import { CURRENCIES, LOCALES } from "@ai-ems/contracts/organization";

const currencyNames = new Intl.DisplayNames(["en"], { type: "currency" });
const localeNames = new Intl.DisplayNames(["en"], { type: "language" });

export function currencyOptions() {
  return CURRENCIES.map((code) => ({
    value: code,
    label: `${code} — ${currencyNames.of(code) ?? code}`,
  }));
}

export function localeOptions() {
  return LOCALES.map((code) => ({ value: code, label: localeNames.of(code) ?? code }));
}

export function timeZoneOptions(): string[] {
  const all =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return [...new Set(["UTC", ...all])].sort();
}
