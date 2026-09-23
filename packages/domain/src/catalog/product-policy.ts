import { defineMachine } from "../workflow/state-machine";

/**
 * Catalog rules: what a SKU may look like, when a product may be sold, and
 * what makes an option group usable. Pure, so the editor can warn before the
 * server refuses — and so the rules are testable without a database.
 */
export type ProductStatus = "DRAFT" | "ACTIVE" | "DISCONTINUED";
export type ProductAction = "publish" | "unpublish" | "discontinue" | "restore";

export const productMachine = defineMachine<ProductStatus, ProductAction>("Product", [
  { action: "publish", from: ["DRAFT"], to: "ACTIVE", permission: "catalog.product.write" },
  { action: "unpublish", from: ["ACTIVE"], to: "DRAFT", permission: "catalog.product.write" },
  {
    action: "discontinue",
    from: ["ACTIVE", "DRAFT"],
    to: "DISCONTINUED",
    permission: "catalog.product.write",
  },
  { action: "restore", from: ["DISCONTINUED"], to: "DRAFT", permission: "catalog.product.write" },
]);

export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,23}$/;
export const CODE_PATTERN = /^[a-z0-9][a-z0-9_]{1,23}$/;

/** "Olive Velvet 3-seater" → "OLIVE-VELVET-3-SEATER" (trimmed to fit). */
export function skuFromName(name: string): string {
  const sku = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return SKU_PATTERN.test(sku) ? sku : `SKU-${sku}`.slice(0, 24).replace(/-+$/, "");
}

/** "Fabric colour" → "fabric_colour" — stable identifiers for option groups. */
export function codeFromLabel(label: string): string {
  const code = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return CODE_PATTERN.test(code) ? code : `opt_${code}`.slice(0, 24).replace(/_+$/, "");
}

export interface OptionGroupFacts {
  input: "SELECT" | "MULTI_SELECT" | "NUMBER" | "TEXT" | "BOOLEAN";
  required: boolean;
  optionCount: number;
  minValue: number | null;
  maxValue: number | null;
}

export interface ProductFacts {
  status: ProductStatus;
  isConfigurable: boolean;
  basePrice: number;
  groups: OptionGroupFacts[];
  /** Open quotes or orders referencing the product. */
  inUse: boolean;
}

export type CatalogResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid_transition"
        | "needs_options"
        | "needs_price"
        | "empty_group"
        | "bad_range"
        | "in_use";
    };

export const CATALOG_MESSAGES: Record<Extract<CatalogResult, { ok: false }>["reason"], string> = {
  invalid_transition: "That isn't a valid next step for this product.",
  needs_options: "A configurable product needs at least one option group before it goes live.",
  needs_price: "Set a base price above zero before publishing.",
  empty_group: "Every choice list needs at least one option people can pick.",
  bad_range: "The smallest value has to be below the largest.",
  in_use: "This product appears on open quotes or orders — discontinue it instead.",
};

const fail = (reason: Extract<CatalogResult, { ok: false }>["reason"]): CatalogResult => ({
  ok: false,
  reason,
});

/** A group people choose from needs something to choose; a numeric one needs a sane range. */
export function validateOptionGroup(group: OptionGroupFacts): CatalogResult {
  const picks = group.input === "SELECT" || group.input === "MULTI_SELECT";
  if (picks && group.optionCount === 0) return fail("empty_group");
  if (
    group.input === "NUMBER" &&
    group.minValue !== null &&
    group.maxValue !== null &&
    group.minValue >= group.maxValue
  ) {
    return fail("bad_range");
  }
  return { ok: true };
}

/** Publishing is the gate: everything a salesperson needs must already be there. */
export function canTransitionProduct(product: ProductFacts, action: ProductAction): CatalogResult {
  if (!productMachine.can(product.status, action)) return fail("invalid_transition");
  if (action !== "publish") return { ok: true };
  if (product.basePrice <= 0) return fail("needs_price");
  if (product.isConfigurable && product.groups.length === 0) return fail("needs_options");
  for (const group of product.groups) {
    const result = validateOptionGroup(group);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/** Deleting is only for products nothing points at yet. */
export function canDeleteProduct(product: ProductFacts): CatalogResult {
  if (product.inUse) return fail("in_use");
  if (product.status !== "DRAFT") return fail("invalid_transition");
  return { ok: true };
}

/**
 * What a customer would pay for one unit with these options chosen, in the
 * same order the pricing engine applies them: base, then absolute deltas,
 * then percentages of the base.
 */
export function unitPriceWithOptions(
  basePrice: number,
  options: Array<{ priceDelta: number; pricePctDelta: number }>,
): number {
  const total = options.reduce(
    (sum, option) => sum + option.priceDelta + (basePrice * option.pricePctDelta) / 100,
    basePrice,
  );
  return Math.round(total * 100) / 100;
}
