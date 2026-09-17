import { fromMinor } from "../money/money";
import { decideDiscount, priceLine } from "./price-line";

describe("priceLine", () => {
  const base = {
    basePrice: "1000.00",
    quantity: "2",
    discountPct: "10",
    taxRatePct: "18",
    selectedOptions: [
      { code: "finish", label: "Premium finish", priceDelta: "150.00", pricePctDelta: "0" },
      { code: "size", label: "Large size", priceDelta: "0", pricePctDelta: "5" },
    ],
  };

  it("computes a full breakdown", () => {
    const r = priceLine(base);
    expect(fromMinor(r.unitPrice)).toBe("1200.00"); // 1000 + 150 + 5% of 1000
    expect(fromMinor(r.gross)).toBe("2400.00");
    expect(fromMinor(r.discount)).toBe("240.00");
    expect(fromMinor(r.net)).toBe("2160.00");
    expect(fromMinor(r.tax)).toBe("388.80");
    expect(fromMinor(r.total)).toBe("2548.80");
    expect(r.components).toHaveLength(3);
  });

  it("supports fractional quantities", () => {
    const r = priceLine({
      ...base,
      quantity: "1.5",
      discountPct: "0",
      taxRatePct: "0",
      selectedOptions: [],
    });
    expect(fromMinor(r.total)).toBe("1500.00");
  });

  it("validates quantity and discount", () => {
    expect(() => priceLine({ ...base, quantity: "0" })).toThrow(RangeError);
    expect(() => priceLine({ ...base, discountPct: "120" })).toThrow(RangeError);
  });
});

describe("decideDiscount", () => {
  const policy = { autoApproveUpToPct: 10, maxPct: 30 };
  it.each([
    [0, "auto_approved"],
    [10, "auto_approved"],
    [10.5, "needs_approval"],
    [30, "needs_approval"],
    [31, "rejected"],
    [-1, "rejected"],
  ] as const)("%s%% → %s", (pct, expected) => {
    expect(decideDiscount(pct, policy)).toBe(expected);
  });
});
