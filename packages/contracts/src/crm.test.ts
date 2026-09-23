import {
  accountSchema,
  contactSchema,
  createLeadSchema,
  logActivitySchema,
  toAmount,
  toDate,
  transitionLeadSchema,
} from "./crm";

describe("CRM contracts", () => {
  it("accepts money the way people type it", () => {
    const ok = (estimatedValue: string) =>
      createLeadSchema.safeParse({ title: "Showroom sofa", estimatedValue }).success;
    expect(ok("12,500.50")).toBe(true);
    expect(ok("2500")).toBe(true);
    expect(ok("")).toBe(true);
    expect(ok("1.234")).toBe(false);
    expect(ok("abc")).toBe(false);

    // Values stay strings for the form; the edge converts them.
    expect(toAmount("12,500.50")).toBe(12500.5);
    expect(toAmount("2500")).toBe(2500);
    expect(toAmount("")).toBeNull();
    expect(toAmount(undefined)).toBeNull();
  });

  it("checks that a picked date is real, and converts it to a UTC day", () => {
    expect(
      createLeadSchema.safeParse({ title: "Lead", nextFollowUpAt: "2026-10-01" }).success,
    ).toBe(true);
    expect(createLeadSchema.safeParse({ title: "Lead", nextFollowUpAt: "" }).success).toBe(true);
    expect(
      createLeadSchema.safeParse({ title: "Lead", nextFollowUpAt: "2026-02-31" }).success,
    ).toBe(false);
    expect(toDate("2026-10-01")).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(toDate("")).toBeNull();
  });

  it("validates websites and emails only when they were filled in", () => {
    expect(accountSchema.safeParse({ name: "Acme", website: "" }).success).toBe(true);
    expect(accountSchema.safeParse({ name: "Acme", website: "acme.com" }).success).toBe(false);
    expect(accountSchema.safeParse({ name: "Acme", website: "https://acme.com" }).success).toBe(
      true,
    );
    expect(contactSchema.safeParse({ firstName: "Ada", email: "" }).success).toBe(true);
    expect(contactSchema.safeParse({ firstName: "Ada", email: "nope" }).success).toBe(false);
  });

  it("keeps free text within the column limits", () => {
    expect(accountSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(logActivitySchema.safeParse({ leadId: "l1", subject: "x" }).success).toBe(false);
    expect(
      logActivitySchema.safeParse({ leadId: "l1", subject: "Called about the quote" }).success,
    ).toBe(true);
    expect(
      logActivitySchema.safeParse({ leadId: "l1", subject: "ok", body: "x".repeat(2001) }).success,
    ).toBe(false);
  });

  it("only accepts known lifecycle actions", () => {
    expect(transitionLeadSchema.safeParse({ leadId: "l1", action: "qualify" }).success).toBe(true);
    expect(transitionLeadSchema.safeParse({ leadId: "l1", action: "delete" }).success).toBe(false);
  });
});
