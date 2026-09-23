import { z } from "zod";

import { CODE_PATTERN, SKU_PATTERN } from "@ai-ems/domain/catalog/product-policy";

/** Input contracts for categories, products, option groups and options. */

export const OPTION_INPUTS = ["SELECT", "MULTI_SELECT", "NUMBER", "TEXT", "BOOLEAN"] as const;
export const PRODUCT_ACTIONS = ["publish", "unpublish", "discontinue", "restore"] as const;

const label = (max: number) => z.string().trim().min(2, "Use at least 2 characters").max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Money as typed; converted at the edge with `toMoney`. */
const money = z
  .string()
  .trim()
  .refine(
    (value) => /^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d{1,12}(\.\d{1,2})?$/.test(value),
    "Use a number like 1200 or 1,200.50",
  );

/** A delta may be negative — options can make a product cheaper. */
const signedMoney = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^-?\d{1,12}(\.\d{1,2})?$/.test(value),
    "Use a number like 150 or -25",
  );

const percent = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^-?\d{1,3}(\.\d{1,4})?$/.test(value),
    "Use a percentage like 7.5",
  );

const optionalNumber = z
  .string()
  .trim()
  .refine((value) => value === "" || /^-?\d{1,9}(\.\d{1,3})?$/.test(value), "Use a number");

export function toMoney(value: string | undefined): number {
  const cleaned = (value ?? "").replaceAll(",", "").trim();
  return cleaned === "" ? 0 : Number(cleaned);
}

export function toOptionalNumber(value: string | undefined): number | null {
  const cleaned = (value ?? "").replaceAll(",", "").trim();
  return cleaned === "" ? null : Number(cleaned);
}

export const categorySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,23}$/, "Letters, numbers and dashes, 2–24 characters"),
  name: label(80),
  parentId: z.string().max(40).optional().or(z.literal("")),
  sortOrder: z.coerce.number<string>().int().min(0).max(9999).default(0),
});

export const categoryIdSchema = z.object({ categoryId: z.string().min(1) });

export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .regex(SKU_PATTERN, "Capitals, numbers and dashes, 2–24 characters"),
  name: label(120),
  description: optionalText(2000),
  categoryId: z.string().min(1, "Choose a category"),
  basePrice: money,
  taxRatePct: percent,
  leadTimeDays: z.coerce.number<string>().int().min(0).max(365).default(0),
  isConfigurable: z.boolean().default(false),
});

export const productIdSchema = z.object({ productId: z.string().min(1) });

export const productActionSchema = z.object({
  productId: z.string().min(1),
  action: z.enum(PRODUCT_ACTIONS),
});

export const optionGroupSchema = z.object({
  productId: z.string().min(1),
  groupId: z.string().max(40).optional().or(z.literal("")),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(CODE_PATTERN, "Lower case letters, numbers and underscores")
    .optional()
    .or(z.literal("")),
  label: label(80),
  input: z.enum(OPTION_INPUTS).default("SELECT"),
  required: z.boolean().default(false),
  minValue: optionalNumber.optional(),
  maxValue: optionalNumber.optional(),
  sortOrder: z.coerce.number<string>().int().min(0).max(9999).default(0),
  /** Empty means "always ask"; otherwise ask only when `visibleWhenGroup` is this option. */
  visibleWhenGroup: z.string().trim().max(24).optional().or(z.literal("")),
  visibleWhenOption: z.string().trim().max(24).optional().or(z.literal("")),
});

export const groupIdSchema = z.object({ groupId: z.string().min(1) });

export const optionSchema = z.object({
  groupId: z.string().min(1),
  optionId: z.string().max(40).optional().or(z.literal("")),
  label: label(80),
  priceDelta: signedMoney.optional(),
  pricePctDelta: percent.optional(),
  sortOrder: z.coerce.number<string>().int().min(0).max(9999).default(0),
});

export const optionIdSchema = z.object({ optionId: z.string().min(1) });

/** What the pricing preview sends: a product and the options picked. */
export const priceProbeSchema = z.object({
  productId: z.string().min(1),
  optionIds: z.array(z.string().min(1)).max(50).default([]),
  quantity: z.coerce.number<string>().int().min(1).max(9999).default(1),
});

export type CategoryInput = z.input<typeof categorySchema>;
export type ProductInput = z.input<typeof productSchema>;
export type OptionGroupInput = z.input<typeof optionGroupSchema>;
export type OptionInput = z.input<typeof optionSchema>;

// ─── Configurator ─────────────────────────────────────────────────────────

/** One answer per option group: a code, several codes, a number, text or a flag. */
export const answerSchema = z.union([
  z.string().max(200),
  z.array(z.string().max(64)).max(50),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const configurationSchema = z.object({
  productId: z.string().min(1),
  leadId: z.string().max(40).optional().or(z.literal("")),
  name: z.string().trim().min(2, "Name it so you can recognise it later").max(80),
  quantity: z.coerce.number<string>().int().min(1).max(9999).default(1),
  /** Sent as JSON because the shape depends on the product's own groups. */
  answers: z.string().max(20_000),
});

export const configurationIdSchema = z.object({ configurationId: z.string().min(1) });

/** "Only ask this group when <group> is <option>" — the rule the editor writes. */
export const visibilityRuleSchema = z.object({
  group: z.string().trim().max(24),
  equals: z.string().trim().max(24),
});

export type ConfigurationFormInput = z.input<typeof configurationSchema>;
