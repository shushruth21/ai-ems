import { multiply, percentOf, sum, toMinor, type Minor } from "../money/money";

export interface OptionPrice {
  code: string;
  label: string;
  /** Absolute delta per unit, e.g. "250.00" */
  priceDelta: string;
  /** Percentage of base price, e.g. "5" for +5% */
  pricePctDelta: string;
}

export interface LineInput {
  basePrice: string;
  quantity: string;
  selectedOptions: OptionPrice[];
  discountPct: string;
  taxRatePct: string;
}

export interface LineBreakdown {
  unitPrice: Minor;
  optionsTotal: Minor;
  gross: Minor;
  discount: Minor;
  net: Minor;
  tax: Minor;
  total: Minor;
  components: { label: string; amount: Minor }[];
}

/**
 * Server-side line pricing: base + option deltas → × qty → − discount → + tax.
 * Returns a breakdown that is stored on the line for audit.
 */
export function priceLine(input: LineInput): LineBreakdown {
  const base = toMinor(input.basePrice);
  const qty = Number(input.quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new RangeError("Quantity must be greater than zero");
  const discountPct = Number(input.discountPct);
  if (discountPct < 0 || discountPct > 100)
    throw new RangeError("Discount must be between 0 and 100");

  const components = input.selectedOptions.map((o) => ({
    label: o.label,
    amount: toMinor(o.priceDelta) + percentOf(base, o.pricePctDelta),
  }));
  const optionsTotal = sum(components.map((c) => c.amount));
  const unitPrice = base + optionsTotal;
  const gross = multiply(unitPrice, input.quantity, 3);
  const discount = percentOf(gross, input.discountPct);
  const net = gross - discount;
  const tax = percentOf(net, input.taxRatePct);

  return {
    unitPrice,
    optionsTotal,
    gross,
    discount,
    net,
    tax,
    total: net + tax,
    components: [{ label: "Base price", amount: base }, ...components],
  };
}

export interface DiscountPolicy {
  /** Max discount % a rep can give without approval. */
  autoApproveUpToPct: number;
  /** Hard ceiling — above this nobody can approve. */
  maxPct: number;
}

export type DiscountDecision = "auto_approved" | "needs_approval" | "rejected";

export function decideDiscount(discountPct: number, policy: DiscountPolicy): DiscountDecision {
  if (discountPct < 0 || discountPct > policy.maxPct) return "rejected";
  return discountPct <= policy.autoApproveUpToPct ? "auto_approved" : "needs_approval";
}
