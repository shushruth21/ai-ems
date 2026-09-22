import {
  canCreateRole,
  canDeleteRole,
  canUpdateRole,
  escalatingPermissions,
  MAX_CUSTOM_ROLES,
  roleKeyFromName,
  type RoleFacts,
} from "./role-policy";

const custom: RoleFacts = { key: "shop_lead", isSystem: false, memberCount: 0 };
const admin = ["crm.lead.read", "crm.lead.write", "sales.order.read"];

describe("role keys", () => {
  it("derives a key from a name", () => {
    expect(roleKeyFromName("Shop floor lead")).toBe("shop_floor_lead");
    expect(roleKeyFromName("  Qualité & Sécurité ")).toBe("qualite_securite");
    expect(roleKeyFromName("2nd shift")).toBe("role_2nd_shift");
    expect(roleKeyFromName("x".repeat(60))).toHaveLength(40);
  });
});

describe("no privilege escalation", () => {
  it("lists permissions the actor doesn't hold", () => {
    expect(escalatingPermissions(admin, ["crm.lead.read", "platform.roles.manage"])).toEqual([
      "platform.roles.manage",
    ]);
    expect(escalatingPermissions(admin, ["crm.lead.read"])).toEqual([]);
  });

  it("blocks creating a role with permissions the actor lacks", () => {
    expect(canCreateRole(admin, ["crm.lead.read"], 0)).toEqual({ ok: true });
    expect(canCreateRole(admin, ["finance.invoice.write"], 0)).toEqual({
      ok: false,
      reason: "escalation",
      details: ["finance.invoice.write"],
    });
    expect(canCreateRole(admin, [], 0).ok).toBe(false);
    expect(canCreateRole(admin, ["crm.lead.read"], MAX_CUSTOM_ROLES)).toMatchObject({
      reason: "limit_reached",
    });
  });

  it("blocks removing permissions the actor lacks", () => {
    const current = ["crm.lead.read", "finance.invoice.write"];
    expect(canUpdateRole(custom, admin, current, ["crm.lead.read"])).toMatchObject({
      reason: "escalation",
      details: ["finance.invoice.write"],
    });
    expect(canUpdateRole(custom, admin, current, current).ok).toBe(true);
    expect(canUpdateRole(custom, admin, ["crm.lead.read"], ["crm.lead.write"]).ok).toBe(true);
  });
});

describe("system roles and roles in use", () => {
  it("never edits or deletes a built-in role", () => {
    const system: RoleFacts = { key: "admin", isSystem: true, memberCount: 3 };
    expect(canUpdateRole(system, admin, [], ["crm.lead.read"])).toMatchObject({
      reason: "system_role",
    });
    expect(canDeleteRole(system)).toMatchObject({ reason: "system_role" });
  });

  it("refuses to delete a role that still has members", () => {
    expect(canDeleteRole({ ...custom, memberCount: 1 })).toMatchObject({ reason: "role_in_use" });
    expect(canDeleteRole(custom).ok).toBe(true);
  });
});
