import {
  createOrganizationSchema,
  invitationTokenSchema,
  inviteMemberSchema,
  isTimeZone,
  updateOrganizationSchema,
} from "./organization";

describe("organization contracts", () => {
  const valid = {
    name: "Acme Studio",
    slug: " Acme-Studio ",
    currency: "USD",
    timezone: "America/New_York",
  };

  it("normalizes and accepts a valid organization", () => {
    expect(createOrganizationSchema.parse(valid).slug).toBe("acme-studio");
  });

  it("rejects reserved or malformed slugs with readable messages", () => {
    const reserved = createOrganizationSchema.safeParse({ ...valid, slug: "login" });
    expect(reserved.error?.issues[0]?.message).toMatch(/reserved/);
    expect(createOrganizationSchema.safeParse({ ...valid, slug: "a_b" }).success).toBe(false);
  });

  it("validates currency and time zone", () => {
    expect(createOrganizationSchema.safeParse({ ...valid, currency: "XYZ" }).success).toBe(false);
    expect(createOrganizationSchema.safeParse({ ...valid, timezone: "Mars/Olympus" }).success).toBe(
      false,
    );
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Asia/Kolkata")).toBe(true);
  });

  it("allows clearing optional settings", () => {
    const parsed = updateOrganizationSchema.parse({
      name: "Acme",
      legalName: "",
      taxId: "",
      currency: "EUR",
      timezone: "Europe/Berlin",
      locale: "de-DE",
    });
    expect(parsed.legalName).toBe("");
  });

  it("validates invitations", () => {
    expect(
      inviteMemberSchema.parse({ email: " Ada@Example.com", roleKey: "sales_rep" }).email,
    ).toBe("ada@example.com");
    expect(
      inviteMemberSchema.safeParse({ email: "ada@example.com", roleKey: "Owner!" }).success,
    ).toBe(false);
    expect(invitationTokenSchema.safeParse("a".repeat(43)).success).toBe(true);
    expect(invitationTokenSchema.safeParse("a".repeat(42)).success).toBe(false);
  });
});
