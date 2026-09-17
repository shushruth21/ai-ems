import { formatMoney, fromMinor, multiply, percentOf, sum, toMinor } from "./money";

describe("money", () => {
  it("parses strings and numbers into minor units", () => {
    expect(toMinor("1234.56")).toBe(123456n);
    expect(toMinor("1,000")).toBe(100000n);
    expect(toMinor(19.99)).toBe(1999n);
    expect(toMinor("-2.5")).toBe(-250n);
  });

  it("rounds half away from zero at the third decimal", () => {
    expect(toMinor("1.005")).toBe(101n);
    expect(toMinor("1.004")).toBe(100n);
    expect(toMinor("-1.005")).toBe(-101n);
  });

  it("rejects malformed input", () => {
    expect(() => toMinor("abc")).toThrow(RangeError);
    expect(() => toMinor("")).toThrow(RangeError);
  });

  it("formats back to a decimal string", () => {
    expect(fromMinor(123456n)).toBe("1234.56");
    expect(fromMinor(-5n)).toBe("-0.05");
  });

  it("multiplies without float error", () => {
    expect(multiply(toMinor("0.10"), "3")).toBe(30n);
    expect(multiply(toMinor("19.99"), "2.5", 3)).toBe(4998n); // 49.975 → 49.98
    expect(multiply(toMinor("-10.00"), "0.333")).toBe(-333n);
  });

  it("computes percentages and sums", () => {
    expect(percentOf(toMinor("200"), 12.5)).toBe(2500n);
    expect(sum([1n, 2n, 3n])).toBe(6n);
  });

  it("formats currency", () => {
    expect(formatMoney(123456n, "USD")).toBe("$1,234.56");
  });
});
