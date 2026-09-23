import {
  canDeleteProduct,
  canTransitionProduct,
  codeFromLabel,
  productMachine,
  skuFromName,
  unitPriceWithOptions,
  validateOptionGroup,
  type OptionGroupFacts,
  type ProductFacts,
} from "./product-policy";

const group = (over: Partial<OptionGroupFacts> = {}): OptionGroupFacts => ({
  input: "SELECT",
  required: true,
  optionCount: 3,
  minValue: null,
  maxValue: null,
  ...over,
});

const product = (over: Partial<ProductFacts> = {}): ProductFacts => ({
  status: "DRAFT",
  isConfigurable: false,
  basePrice: 1200,
  groups: [],
  inUse: false,
  ...over,
});

describe("identifiers", () => {
  it("derives a usable SKU from a product name", () => {
    expect(skuFromName("Olive velvet 3-seater")).toBe("OLIVE-VELVET-3-SEATER");
    expect(skuFromName("  spaced  out  ")).toBe("SPACED-OUT");
    expect(skuFromName("a".repeat(40))).toHaveLength(24);
    // A name with nothing usable still produces a valid SKU.
    expect(skuFromName("…")).toMatch(/^[A-Z0-9][A-Z0-9-]*$/);
  });

  it("derives snake_case option codes", () => {
    expect(codeFromLabel("Fabric colour")).toBe("fabric_colour");
    expect(codeFromLabel("Width (cm)")).toBe("width_cm");
    expect(codeFromLabel("1")).toMatch(/^[a-z0-9][a-z0-9_]+$/);
  });
});

describe("option groups", () => {
  it("insists a choice list has something to choose", () => {
    expect(validateOptionGroup(group())).toEqual({ ok: true });
    expect(validateOptionGroup(group({ optionCount: 0 }))).toEqual({
      ok: false,
      reason: "empty_group",
    });
    // Free-text and numeric groups don't need options.
    expect(validateOptionGroup(group({ input: "TEXT", optionCount: 0 }))).toEqual({ ok: true });
  });

  it("checks numeric ranges make sense", () => {
    expect(
      validateOptionGroup(group({ input: "NUMBER", optionCount: 0, minValue: 40, maxValue: 300 })),
    ).toEqual({ ok: true });
    expect(
      validateOptionGroup(group({ input: "NUMBER", optionCount: 0, minValue: 300, maxValue: 40 })),
    ).toEqual({ ok: false, reason: "bad_range" });
    // One-sided ranges are fine.
    expect(
      validateOptionGroup(group({ input: "NUMBER", optionCount: 0, minValue: 40, maxValue: null })),
    ).toEqual({ ok: true });
  });
});

describe("product lifecycle", () => {
  it("offers the steps that make sense", () => {
    expect(productMachine.actionsFrom("DRAFT").sort()).toEqual(["discontinue", "publish"]);
    expect(productMachine.actionsFrom("ACTIVE").sort()).toEqual(["discontinue", "unpublish"]);
    expect(productMachine.actionsFrom("DISCONTINUED")).toEqual(["restore"]);
  });

  it("won't publish something a salesperson can't sell", () => {
    expect(canTransitionProduct(product(), "publish")).toEqual({ ok: true });
    expect(canTransitionProduct(product({ basePrice: 0 }), "publish")).toEqual({
      ok: false,
      reason: "needs_price",
    });
    expect(canTransitionProduct(product({ isConfigurable: true }), "publish")).toEqual({
      ok: false,
      reason: "needs_options",
    });
    expect(
      canTransitionProduct(
        product({ isConfigurable: true, groups: [group({ optionCount: 0 })] }),
        "publish",
      ),
    ).toEqual({ ok: false, reason: "empty_group" });
    expect(
      canTransitionProduct(product({ isConfigurable: true, groups: [group()] }), "publish"),
    ).toEqual({ ok: true });
  });

  it("only checks readiness when publishing", () => {
    expect(canTransitionProduct(product({ basePrice: 0 }), "discontinue")).toEqual({ ok: true });
    expect(canTransitionProduct(product({ status: "ACTIVE" }), "publish")).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
  });

  it("deletes only unused drafts", () => {
    expect(canDeleteProduct(product())).toEqual({ ok: true });
    expect(canDeleteProduct(product({ inUse: true }))).toEqual({ ok: false, reason: "in_use" });
    expect(canDeleteProduct(product({ status: "ACTIVE" }))).toEqual({
      ok: false,
      reason: "invalid_transition",
    });
  });
});

describe("unit price with options", () => {
  it("adds absolute deltas and percentages of the base", () => {
    expect(unitPriceWithOptions(1000, [])).toBe(1000);
    expect(unitPriceWithOptions(1000, [{ priceDelta: 150, pricePctDelta: 0 }])).toBe(1150);
    expect(unitPriceWithOptions(1000, [{ priceDelta: 0, pricePctDelta: 12.5 }])).toBe(1125);
    expect(
      unitPriceWithOptions(1000, [
        { priceDelta: 150, pricePctDelta: 0 },
        { priceDelta: 0, pricePctDelta: 10 },
      ]),
    ).toBe(1250);
    // Percentages are always of the base, never compounded.
    expect(unitPriceWithOptions(99.99, [{ priceDelta: 0.01, pricePctDelta: 0 }])).toBe(100);
  });
});
