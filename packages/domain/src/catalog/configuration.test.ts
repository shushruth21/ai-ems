import {
  chosenOptions,
  describeConfiguration,
  isVisible,
  priceConfiguration,
  validateConfiguration,
  visibleGroups,
  type GroupSpec,
  type ProductSpec,
} from "./configuration";

const fabric: GroupSpec = {
  code: "fabric",
  label: "Fabric",
  input: "SELECT",
  required: true,
  minValue: null,
  maxValue: null,
  options: [
    { code: "standard", label: "Standard weave", priceDelta: "0", pricePctDelta: "0" },
    { code: "velvet", label: "Olive velvet", priceDelta: "150", pricePctDelta: "0" },
    { code: "leather", label: "Full-grain leather", priceDelta: "0", pricePctDelta: "25" },
  ],
};

const velvetCare: GroupSpec = {
  code: "care_kit",
  label: "Velvet care kit",
  input: "BOOLEAN",
  required: false,
  minValue: null,
  maxValue: null,
  options: [],
  // Only worth asking when they picked velvet.
  visibleWhen: { group: "fabric", equals: "velvet" },
};

const width: GroupSpec = {
  code: "width",
  label: "Width (cm)",
  input: "NUMBER",
  required: true,
  minValue: 140,
  maxValue: 260,
  options: [],
};

const extras: GroupSpec = {
  code: "extras",
  label: "Extras",
  input: "MULTI_SELECT",
  required: false,
  minValue: null,
  maxValue: null,
  options: [
    { code: "cushions", label: "Scatter cushions", priceDelta: "80", pricePctDelta: "0" },
    { code: "legs", label: "Brass legs", priceDelta: "120", pricePctDelta: "0" },
  ],
};

const sofa: ProductSpec = {
  sku: "SOFA-3S",
  name: "Three-seat sofa",
  basePrice: "1200.00",
  taxRatePct: "0",
  groups: [fabric, velvetCare, width, extras],
};

describe("visibility rules", () => {
  it("hides a group until its trigger is answered", () => {
    expect(visibleGroups(sofa, {}).map((g) => g.code)).toEqual(["fabric", "width", "extras"]);
    expect(visibleGroups(sofa, { fabric: "velvet" }).map((g) => g.code)).toContain("care_kit");
    expect(visibleGroups(sofa, { fabric: "leather" }).map((g) => g.code)).not.toContain("care_kit");
  });

  it("combines rules with all / any / not", () => {
    const answers = { fabric: "velvet", width: 200 };
    expect(isVisible({ any: [{ group: "fabric", equals: "leather" }] }, answers)).toBe(false);
    expect(
      isVisible(
        {
          all: [
            { group: "fabric", equals: "velvet" },
            { group: "width", answered: true },
          ],
        },
        answers,
      ),
    ).toBe(true);
    expect(isVisible({ not: { group: "fabric", equals: "velvet" } }, answers)).toBe(false);
    expect(isVisible({ group: "fabric", in: ["velvet", "leather"] }, answers)).toBe(true);
    expect(isVisible({ group: "extras", answered: false }, answers)).toBe(true);
    // A multi-select matches when any of its values match.
    expect(isVisible({ group: "extras", equals: "legs" }, { extras: ["cushions", "legs"] })).toBe(
      true,
    );
  });

  it("shows the group when there is no rule", () => {
    expect(isVisible(null, {})).toBe(true);
    expect(isVisible(undefined, {})).toBe(true);
  });
});

describe("validation", () => {
  it("asks for the required answers it is actually showing", () => {
    const empty = validateConfiguration(sofa, {});
    expect(empty.ok).toBe(false);
    expect(empty.issues.map((i) => i.group).sort()).toEqual(["fabric", "width"]);

    const done = validateConfiguration(sofa, { fabric: "velvet", width: 200 });
    expect(done.ok).toBe(true);
    expect(done.cleaned).toEqual({ fabric: "velvet", width: 200 });
  });

  it("never demands an answer to a hidden question", () => {
    const hidden: ProductSpec = {
      ...sofa,
      groups: [fabric, { ...velvetCare, required: true }, width],
    };
    expect(validateConfiguration(hidden, { fabric: "leather", width: 200 }).ok).toBe(true);
    expect(validateConfiguration(hidden, { fabric: "velvet", width: 200 }).ok).toBe(false);
  });

  it("drops answers to questions that are no longer asked", () => {
    // They chose velvet, added the care kit, then switched to leather.
    const { cleaned } = validateConfiguration(sofa, {
      fabric: "leather",
      care_kit: true,
      width: 200,
    });
    expect(cleaned).toEqual({ fabric: "leather", width: 200 });
  });

  it("rejects option codes that don't belong to the group", () => {
    const result = validateConfiguration(sofa, { fabric: "gold-plated", width: 200 });
    expect(result.issues).toEqual([
      { group: "fabric", message: "That isn't an option for Fabric." },
    ]);
  });

  it("keeps numbers inside their range", () => {
    expect(validateConfiguration(sofa, { fabric: "velvet", width: 100 }).issues[0]?.message).toBe(
      "Width (cm) starts at 140.",
    );
    expect(validateConfiguration(sofa, { fabric: "velvet", width: 400 }).issues[0]?.message).toBe(
      "Width (cm) tops out at 260.",
    );
    expect(
      validateConfiguration(sofa, { fabric: "velvet", width: "wide" }).issues[0]?.message,
    ).toBe("Width (cm) must be a number.");
    // Typed with a separator, as people do.
    expect(validateConfiguration(sofa, { fabric: "velvet", width: "1,60" }).ok).toBe(true);
  });

  it("de-duplicates a multi-select and rejects unknown members", () => {
    const ok = validateConfiguration(sofa, {
      fabric: "velvet",
      width: 200,
      extras: ["legs", "legs", "cushions"],
    });
    expect(ok.cleaned.extras).toEqual(["legs", "cushions"]);
    expect(validateConfiguration(sofa, { fabric: "velvet", width: 200, extras: ["gold"] }).ok).toBe(
      false,
    );
  });
});

describe("pricing a configuration", () => {
  it("adds deltas and percentages of the base, and multiplies by quantity", () => {
    const priced = priceConfiguration(sofa, {
      fabric: "velvet",
      width: 200,
      extras: ["cushions"],
    });
    expect(priced.ok).toBe(true);
    // 1200 + 150 (velvet) + 80 (cushions)
    expect(priced.unitPrice).toBe("1430.00");
    expect(priced.total).toBe("1430.00");

    const two = priceConfiguration(sofa, { fabric: "leather", width: 200 }, { quantity: "2" });
    // Leather is +25% of the base: 1200 + 300 = 1500, twice.
    expect(two.unitPrice).toBe("1500.00");
    expect(two.total).toBe("3000.00");
  });

  it("applies a discount and tax the way a quote line will", () => {
    const taxed: ProductSpec = { ...sofa, taxRatePct: "10" };
    const priced = priceConfiguration(
      taxed,
      { fabric: "standard", width: 200 },
      { quantity: "1", discountPct: "10" },
    );
    // 1200 − 10% = 1080, + 10% tax = 1188.
    expect(priced.total).toBe("1188.00");
  });

  it("still prices what is valid while answers are missing", () => {
    const priced = priceConfiguration(sofa, { fabric: "velvet" });
    expect(priced.ok).toBe(false);
    expect(priced.issues.map((i) => i.group)).toEqual(["width"]);
    expect(priced.unitPrice).toBe("1350.00");
  });

  it("lists the chosen options and describes them for a human", () => {
    const answers = { fabric: "velvet", width: 200, extras: ["legs"] };
    expect(chosenOptions(sofa, answers).map((c) => c.optionLabel)).toEqual([
      "Olive velvet",
      "Brass legs",
    ]);
    expect(describeConfiguration(sofa, answers)).toEqual([
      "Fabric: Olive velvet",
      "Width (cm): 200",
      "Extras: Brass legs",
    ]);
  });
});
