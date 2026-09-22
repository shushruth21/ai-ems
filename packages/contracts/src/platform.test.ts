import {
  auditFilterSchema,
  createApiKeySchema,
  createRoleSchema,
  updateRoleSchema,
} from "./platform";

describe("platform contracts", () => {
  it("validates roles", () => {
    const ok = createRoleSchema.safeParse({
      name: "  Shop floor lead ",
      description: "",
      permissions: ["crm.lead.read"],
    });
    expect(ok.success && ok.data.name).toBe("Shop floor lead");
    expect(createRoleSchema.safeParse({ name: "x", permissions: ["crm.lead.read"] }).success).toBe(
      false,
    );
    expect(createRoleSchema.safeParse({ name: "Lead", permissions: [] }).success).toBe(false);
    expect(
      createRoleSchema.safeParse({ name: "Lead", permissions: ["nope.fake.perm"] }).success,
    ).toBe(false);
    expect(
      updateRoleSchema.safeParse({ roleId: "r1", name: "Lead", permissions: ["crm.lead.read"] })
        .success,
    ).toBe(true);
  });

  it("validates audit filters and dates", () => {
    expect(auditFilterSchema.parse({ action: " member.removed ", cursor: "42" })).toMatchObject({
      action: "member.removed",
      cursor: "42",
    });
    expect(auditFilterSchema.safeParse({ from: "2026-13-99" }).success).toBe(false);
    expect(auditFilterSchema.safeParse({ cursor: "abc" }).success).toBe(false);
    expect(auditFilterSchema.parse({}).action).toBeUndefined();
  });

  it("validates API keys", () => {
    expect(createApiKeySchema.parse({ name: "CI", scopes: ["read"], expiresInDays: "30" })).toEqual(
      {
        name: "CI",
        scopes: ["read"],
        expiresInDays: 30,
      },
    );
    expect(createApiKeySchema.safeParse({ name: "CI", scopes: [] }).success).toBe(false);
    expect(createApiKeySchema.safeParse({ name: "CI", scopes: ["admin"] }).success).toBe(false);
    expect(
      createApiKeySchema.safeParse({ name: "CI", scopes: ["read"], expiresInDays: "999" }).success,
    ).toBe(false);
  });
});
