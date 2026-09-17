import {
  changePasswordSchema,
  confirmLinkSchema,
  emailSchema,
  mfaVerifySchema,
  nextPathSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  totpCodeSchema,
} from "./auth";

describe("auth contracts", () => {
  it("normalizes emails", () => {
    expect(emailSchema.parse("  Riley@Example.COM ")).toBe("riley@example.com");
    expect(emailSchema.safeParse("nope").success).toBe(false);
    expect(emailSchema.safeParse("").error?.issues[0]?.message).toBe("Enter your email address");
  });

  it("drops unsafe redirect targets instead of failing", () => {
    expect(nextPathSchema.parse("/demo/sales")).toBe("/demo/sales");
    expect(nextPathSchema.parse("https://evil.example")).toBeUndefined();
    expect(nextPathSchema.parse("//evil.example")).toBeUndefined();
    expect(nextPathSchema.parse("/\\evil")).toBeUndefined();
    const r = signInSchema.parse({ email: "a@b.co", password: "x", next: "//evil" });
    expect(r.next).toBeUndefined();
  });

  it("does not apply the new-password policy at sign-in", () => {
    expect(signInSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(true);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("validates sign-up including personal context in the password", () => {
    const base = {
      fullName: "Riley Morgan",
      email: "riley@example.com",
      acceptTerms: true as const,
    };
    expect(signUpSchema.safeParse({ ...base, password: "violet-harbor-lantern-9" }).success).toBe(
      true,
    );
    const bad = signUpSchema.safeParse({ ...base, password: "riley-harbor-lantern" });
    expect(bad.success).toBe(false);
    expect(toFieldErrors(bad.error!).password).toMatch(/name or email/);
    const noTerms = signUpSchema.safeParse({
      ...base,
      password: "violet-harbor-lantern-9",
      acceptTerms: false,
    });
    expect(toFieldErrors(noTerms.error!).acceptTerms).toMatch(/accept the terms/);
  });

  it("requires matching passwords on reset", () => {
    const r = resetPasswordSchema.safeParse({
      password: "violet-harbor-lantern",
      confirmPassword: "different-value-here",
    });
    expect(toFieldErrors(r.error!).confirmPassword).toBe("Passwords don't match");
  });

  it("parses TOTP codes", () => {
    expect(totpCodeSchema.parse(" 123 456 ")).toBe("123456");
    expect(totpCodeSchema.safeParse("12345").success).toBe(false);
    expect(totpCodeSchema.safeParse("abcdef").success).toBe(false);
    expect(mfaVerifySchema.parse({ factorId: "f1", code: "000000" }).code).toBe("000000");
  });

  it("flattens errors to the first message per field", () => {
    const r = signInSchema.safeParse({ email: "", password: "" });
    expect(toFieldErrors(r.error!)).toEqual({
      email: "Enter your email address",
      password: "Enter your password",
    });
  });

  it("change password requires the current password and a different new one", () => {
    const base = { currentPassword: "old password here", confirmPassword: "" };
    expect(
      changePasswordSchema.safeParse({ ...base, password: "", confirmPassword: "" }).success,
    ).toBe(false);
    const same = changePasswordSchema.safeParse({
      currentPassword: "Quiet-River-Lantern-42",
      password: "Quiet-River-Lantern-42",
      confirmPassword: "Quiet-River-Lantern-42",
    });
    expect(same.success).toBe(false);
    const ok = changePasswordSchema.safeParse({
      currentPassword: "anything",
      password: "Quiet-River-Lantern-42",
      confirmPassword: "Quiet-River-Lantern-42",
    });
    expect(ok.success).toBe(true);
  });

  it("confirm link accepts token hashes only", () => {
    expect(confirmLinkSchema.safeParse({ tokenHash: "a".repeat(56), type: "email" }).success).toBe(
      true,
    );
    expect(
      confirmLinkSchema.safeParse({ tokenHash: "<script>alert(1)</script>", type: "email" })
        .success,
    ).toBe(false);
    expect(confirmLinkSchema.safeParse({ tokenHash: "a".repeat(56), type: "sms" }).success).toBe(
      false,
    );
    expect(
      confirmLinkSchema.parse({ tokenHash: "a".repeat(56), type: "recovery", next: "//evil" }).next,
    ).toBeUndefined();
  });
});
