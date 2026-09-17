import { allocate, formatDocumentNumber } from "./document-number";

describe("document numbering", () => {
  it("formats with padding and year", () => {
    expect(formatDocumentNumber("SO", 42, 5, 2026)).toBe("SO-2026-00042");
    expect(formatDocumentNumber("PO", 7, 4)).toBe("PO-0007");
  });

  it("rejects invalid values", () => {
    expect(() => formatDocumentNumber("SO", 0, 5)).toThrow(RangeError);
  });

  it("increments within the same year", () => {
    const { number, next } = allocate(
      { prefix: "SO", nextValue: 9, padding: 3, resetYearly: true, year: 2026 },
      new Date("2026-05-01T00:00:00Z"),
    );
    expect(number).toBe("SO-2026-009");
    expect(next.nextValue).toBe(10);
  });

  it("resets on a new year", () => {
    const { number, next } = allocate(
      { prefix: "SO", nextValue: 512, padding: 3, resetYearly: true, year: 2025 },
      new Date("2026-01-01T00:00:01Z"),
    );
    expect(number).toBe("SO-2026-001");
    expect(next).toMatchObject({ nextValue: 2, year: 2026 });
  });

  it("keeps counting when yearly reset is off", () => {
    const { number } = allocate(
      { prefix: "INV", nextValue: 3, padding: 4, resetYearly: false, year: null },
      new Date("2030-01-01T00:00:00Z"),
    );
    expect(number).toBe("INV-0003");
  });
});
