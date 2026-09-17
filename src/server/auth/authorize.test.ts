import { authorize, can, ForbiddenError } from "./authorize";
import { ALL_PERMISSIONS, resolveRolePermissions, SYSTEM_ROLES } from "./permissions";

describe("authorization", () => {
  const ctx = { permissions: new Set(resolveRolePermissions("sales_rep")) };

  it("grants what the role holds", () => {
    expect(can(ctx, "sales.quote.write")).toBe(true);
    expect(() => authorize(ctx, "sales.order.read", "crm.lead.write")).not.toThrow();
  });

  it("denies what the role lacks", () => {
    expect(can(ctx, "sales.quote.approve")).toBe(false);
    expect(() => authorize(ctx, "procurement.po.approve")).toThrow(ForbiddenError);
  });

  it("owner has every permission; viewer only reads", () => {
    expect(resolveRolePermissions("owner")).toHaveLength(ALL_PERMISSIONS.length);
    expect(resolveRolePermissions("viewer").every((p) => p.endsWith(".read"))).toBe(true);
    expect(resolveRolePermissions("nope")).toEqual([]);
  });

  it("role templates only reference catalog permissions", () => {
    const known = new Set<string>(ALL_PERMISSIONS);
    for (const role of Object.values(SYSTEM_ROLES)) {
      if (role.permissions === "*") continue;
      for (const p of role.permissions) expect(known.has(p)).toBe(true);
    }
  });
});
