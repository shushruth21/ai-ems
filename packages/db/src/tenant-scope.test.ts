import { scopeArgs, TenantScopeError } from "./tenant-scope";

const ORG = "org_a";

describe("scopeArgs", () => {
  it("adds organizationId to reads", () => {
    expect(scopeArgs("Lead", "findMany", { where: { status: "NEW" } }, ORG)).toEqual({
      where: { status: "NEW", organizationId: ORG },
    });
    expect(scopeArgs("Lead", "count", undefined, ORG)).toEqual({ where: { organizationId: ORG } });
  });

  it("stamps organizationId on creates, including batches", () => {
    expect(scopeArgs("Lead", "create", { data: { title: "x" } }, ORG)).toEqual({
      data: { title: "x", organizationId: ORG },
    });
    const batch = scopeArgs("Item", "createMany", { data: [{ code: "a" }, { code: "b" }] }, ORG);
    expect(batch?.data).toEqual([
      { code: "a", organizationId: ORG },
      { code: "b", organizationId: ORG },
    ]);
  });

  it("scopes upserts on both where and create", () => {
    const r = scopeArgs(
      "Setting",
      "upsert",
      { where: { key: "k" }, create: { key: "k" }, update: {} },
      ORG,
    );
    expect(r).toMatchObject({ where: { organizationId: ORG }, create: { organizationId: ORG } });
  });

  it("refuses cross-tenant access", () => {
    expect(() =>
      scopeArgs("Lead", "findMany", { where: { organizationId: "org_b" } }, ORG),
    ).toThrow(TenantScopeError);
    expect(() => scopeArgs("Lead", "create", { data: { organizationId: "org_b" } }, ORG)).toThrow(
      TenantScopeError,
    );
    expect(() =>
      scopeArgs("Lead", "update", { where: { id: "1" }, data: { organizationId: "org_b" } }, ORG),
    ).toThrow(TenantScopeError);
  });

  it("leaves global models untouched", () => {
    const args = { where: { key: "sales.order.read" } };
    expect(scopeArgs("Permission", "findUnique", args, ORG)).toBe(args);
  });

  it("requires an organization id", () => {
    expect(() => scopeArgs("Lead", "findMany", {}, "")).toThrow(TenantScopeError);
  });

  it("rejects unknown operations on tenant models", () => {
    expect(() => scopeArgs("Lead", "$queryRaw", {}, ORG)).toThrow(TenantScopeError);
  });
});
