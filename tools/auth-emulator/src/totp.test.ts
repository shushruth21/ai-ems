import { base32Decode, base32Encode, totp, verifyTotp } from "./totp";

// RFC 6238 Appendix B test secret ("12345678901234567890"), 8-digit vectors truncated to 6.
const SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("round-trips base32", () => {
    expect(base32Decode(SECRET).toString()).toBe("12345678901234567890");
    expect(SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  });

  it("matches RFC 6238 vectors", () => {
    expect(totp(SECRET, 59_000)).toBe("287082");
    expect(totp(SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totp(SECRET, 20_000_000_000_000)).toBe("353130");
  });

  it("tolerates one step of drift only", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(SECRET, totp(SECRET, now - 30_000), now)).toBe(true);
    expect(verifyTotp(SECRET, totp(SECRET, now - 90_000), now)).toBe(false);
  });
});
