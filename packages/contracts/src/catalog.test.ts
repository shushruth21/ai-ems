import {
  categorySchema,
  optionGroupSchema,
  optionSchema,
  productSchema,
  toMoney,
  toOptionalNumber,
} from "./catalog";

const base = {
  sku: "sofa-3s",
  name: "Three-seat sofa",
  categoryId: "cat_1",
  basePrice: "1200",
  taxRatePct: "7.5",
};

describe("catalog contracts", () => {
  it("normalises identifiers as people type them", () => {
    expect(productSchema.parse(base).sku).toBe("SOFA-3S");
    expect(categorySchema.parse({ code: "seating", name: "Seating" }).code).toBe("SEATING");
    expect(productSchema.safeParse({ ...base, sku: "has spaces" }).success).toBe(false);
    expect(categorySchema.safeParse({ code: "x", name: "Too short" }).success).toBe(false);
  });

  it("accepts money and percentages, and converts them at the edge", () => {
    expect(productSchema.safeParse({ ...base, basePrice: "1,200.50" }).success).toBe(true);
    expect(productSchema.safeParse({ ...base, basePrice: "-5" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, basePrice: "1.234" }).success).toBe(false);
    expect(toMoney("1,200.50")).toBe(1200.5);
    expect(toMoney("")).toBe(0);
  });

  it("lets an option make a product cheaper", () => {
    const option = { groupId: "g1", label: "Standard fabric", priceDelta: "-25" };
    expect(optionSchema.safeParse(option).success).toBe(true);
    expect(optionSchema.safeParse({ ...option, priceDelta: "abc" }).success).toBe(false);
    expect(optionSchema.safeParse({ groupId: "g1", label: "A" }).success).toBe(false);
  });

  it("keeps numeric ranges optional but numeric", () => {
    const group = { productId: "p1", label: "Width (cm)", input: "NUMBER" as const };
    expect(optionGroupSchema.safeParse({ ...group, minValue: "40", maxValue: "300" }).success).toBe(
      true,
    );
    expect(optionGroupSchema.safeParse({ ...group, minValue: "", maxValue: "" }).success).toBe(
      true,
    );
    expect(optionGroupSchema.safeParse({ ...group, minValue: "wide" }).success).toBe(false);
    expect(toOptionalNumber("40")).toBe(40);
    expect(toOptionalNumber("")).toBeNull();
  });
});
