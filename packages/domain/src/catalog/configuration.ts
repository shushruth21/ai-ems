import { fromMinor, toMinor, type Minor } from "../money/money";
import { priceLine, type LineBreakdown } from "../pricing/price-line";

/**
 * Turning a set of answers into a priced, valid configuration.
 *
 * A configuration is `{ [groupCode]: value }` — a chosen option code, a list
 * of them, a number, a string or a boolean, depending on the group. Groups can
 * be hidden by a rule on another group's answer, and a hidden group is not
 * asked and not required; that is the whole point of hiding it.
 */
export type AnswerValue = string | string[] | number | boolean | null;
export type Configuration = Record<string, AnswerValue>;

export interface OptionSpec {
  code: string;
  label: string;
  /** Absolute change to the unit price, e.g. "150" or "-25". */
  priceDelta: string;
  /** Percentage of the base price, e.g. "5". */
  pricePctDelta: string;
}

export interface GroupSpec {
  code: string;
  label: string;
  input: "SELECT" | "MULTI_SELECT" | "NUMBER" | "TEXT" | "BOOLEAN";
  required: boolean;
  minValue: number | null;
  maxValue: number | null;
  options: OptionSpec[];
  /** Shown only when this rule holds. Undefined means always shown. */
  visibleWhen?: VisibilityRule | null;
}

export interface ProductSpec {
  sku: string;
  name: string;
  /** Base price as a decimal string, e.g. "1200.00". */
  basePrice: string;
  taxRatePct: string;
  groups: GroupSpec[];
}

/**
 * Visibility rules, deliberately small: a rule reads one other group's answer,
 * and `all` / `any` combine rules. Anything richer belongs in code, not in a
 * JSON column someone edits by hand.
 */
export type VisibilityRule =
  | { group: string; equals: string | number | boolean }
  | { group: string; in: Array<string | number> }
  | { group: string; answered: boolean }
  | { all: VisibilityRule[] }
  | { any: VisibilityRule[] }
  | { not: VisibilityRule };

function answered(value: AnswerValue | undefined): boolean {
  if (value === undefined || value === null || value === "") return false;
  return !(Array.isArray(value) && value.length === 0);
}

/** Evaluates a rule against the answers so far. Unknown shapes show the group. */
export function isVisible(
  rule: VisibilityRule | null | undefined,
  answers: Configuration,
): boolean {
  if (!rule) return true;
  if ("all" in rule) return rule.all.every((r) => isVisible(r, answers));
  if ("any" in rule) return rule.any.some((r) => isVisible(r, answers));
  if ("not" in rule) return !isVisible(rule.not, answers);

  const value = answers[rule.group];
  if ("answered" in rule) return answered(value) === rule.answered;
  if ("equals" in rule) {
    return Array.isArray(value) ? value.includes(String(rule.equals)) : value === rule.equals;
  }
  if ("in" in rule) {
    const wanted = rule.in.map(String);
    return Array.isArray(value)
      ? value.some((v) => wanted.includes(v))
      : wanted.includes(String(value ?? ""));
  }
  return true;
}

/** The groups a person should actually be asked, given what they've answered. */
export function visibleGroups(spec: ProductSpec, answers: Configuration): GroupSpec[] {
  return spec.groups.filter((group) => isVisible(group.visibleWhen, answers));
}

export interface ConfigurationIssue {
  group: string;
  message: string;
}

/**
 * Checks the answers against the visible groups. Answers to hidden groups are
 * dropped rather than rejected — someone may have answered, then changed an
 * earlier choice that hid the question.
 */
export function validateConfiguration(
  spec: ProductSpec,
  answers: Configuration,
): { ok: boolean; issues: ConfigurationIssue[]; cleaned: Configuration } {
  const issues: ConfigurationIssue[] = [];
  const cleaned: Configuration = {};
  const shown = visibleGroups(spec, answers);

  for (const group of shown) {
    const value = answers[group.code];
    if (!answered(value)) {
      if (group.required) issues.push({ group: group.code, message: `Choose ${group.label}.` });
      continue;
    }

    switch (group.input) {
      case "SELECT": {
        const code = String(value);
        if (!group.options.some((o) => o.code === code)) {
          issues.push({ group: group.code, message: `That isn't an option for ${group.label}.` });
          continue;
        }
        cleaned[group.code] = code;
        break;
      }
      case "MULTI_SELECT": {
        const codes = (Array.isArray(value) ? value : [String(value)]).map(String);
        const unknown = codes.filter((c) => !group.options.some((o) => o.code === c));
        if (unknown.length) {
          issues.push({ group: group.code, message: `That isn't an option for ${group.label}.` });
          continue;
        }
        cleaned[group.code] = [...new Set(codes)];
        break;
      }
      case "NUMBER": {
        const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
        if (!Number.isFinite(num)) {
          issues.push({ group: group.code, message: `${group.label} must be a number.` });
          continue;
        }
        if (group.minValue !== null && num < group.minValue) {
          issues.push({
            group: group.code,
            message: `${group.label} starts at ${group.minValue}.`,
          });
          continue;
        }
        if (group.maxValue !== null && num > group.maxValue) {
          issues.push({
            group: group.code,
            message: `${group.label} tops out at ${group.maxValue}.`,
          });
          continue;
        }
        cleaned[group.code] = num;
        break;
      }
      case "BOOLEAN": {
        cleaned[group.code] = value === true || value === "true";
        break;
      }
      case "TEXT":
      default: {
        const text = String(value).trim();
        if (text.length > 200) {
          issues.push({ group: group.code, message: `${group.label} is too long.` });
          continue;
        }
        cleaned[group.code] = text;
        break;
      }
    }
  }

  return { ok: issues.length === 0, issues, cleaned };
}

export interface ChosenOption {
  group: string;
  label: string;
  code: string;
  optionLabel: string;
  priceDelta: string;
  pricePctDelta: string;
}

/** The options a configuration actually selected, in the product's own order. */
export function chosenOptions(spec: ProductSpec, answers: Configuration): ChosenOption[] {
  const chosen: ChosenOption[] = [];
  for (const group of visibleGroups(spec, answers)) {
    const value = answers[group.code];
    if (!answered(value)) continue;
    const codes = Array.isArray(value) ? value.map(String) : [String(value)];
    for (const option of group.options) {
      if (!codes.includes(option.code)) continue;
      chosen.push({
        group: group.code,
        label: group.label,
        code: option.code,
        optionLabel: option.label,
        priceDelta: option.priceDelta,
        pricePctDelta: option.pricePctDelta,
      });
    }
  }
  return chosen;
}

export interface PricedConfiguration {
  ok: boolean;
  issues: ConfigurationIssue[];
  cleaned: Configuration;
  chosen: ChosenOption[];
  breakdown: LineBreakdown;
  /** Decimal strings, for storing and displaying without float drift. */
  unitPrice: string;
  total: string;
}

/**
 * Validates and prices in one step, on the same `priceLine` the quote will
 * use. Invalid configurations are still priced on what *is* valid, so the
 * running total stays useful while someone is still answering.
 */
export function priceConfiguration(
  spec: ProductSpec,
  answers: Configuration,
  options: { quantity?: string; discountPct?: string } = {},
): PricedConfiguration {
  const { ok, issues, cleaned } = validateConfiguration(spec, answers);
  const chosen = chosenOptions(spec, cleaned);
  const breakdown = priceLine({
    basePrice: spec.basePrice,
    quantity: options.quantity ?? "1",
    discountPct: options.discountPct ?? "0",
    taxRatePct: spec.taxRatePct,
    selectedOptions: chosen.map((c) => ({
      code: c.code,
      label: `${c.label}: ${c.optionLabel}`,
      priceDelta: c.priceDelta,
      pricePctDelta: c.pricePctDelta,
    })),
  });

  return {
    ok,
    issues,
    cleaned,
    chosen,
    breakdown,
    unitPrice: fromMinor(breakdown.unitPrice),
    total: fromMinor(breakdown.total),
  };
}

/** One line per answer, for a summary a customer could read. */
export function describeConfiguration(spec: ProductSpec, answers: Configuration): string[] {
  const lines: string[] = [];
  for (const group of visibleGroups(spec, answers)) {
    const value = answers[group.code];
    if (!answered(value)) continue;
    const labels = Array.isArray(value)
      ? value.map((v) => group.options.find((o) => o.code === v)?.label ?? String(v))
      : [group.options.find((o) => o.code === String(value))?.label ?? String(value)];
    lines.push(`${group.label}: ${labels.join(", ")}`);
  }
  return lines;
}

/** Exported for callers that need minor units (storage, further arithmetic). */
export function unitPriceMinor(priced: PricedConfiguration): Minor {
  return toMinor(priced.unitPrice);
}
