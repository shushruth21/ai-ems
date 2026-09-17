import { ALL_PERMISSIONS } from "@/server/auth/permissions";

import { moduleForPath } from "./roadmap";
import { createRandom, previewShellContext, sampleOrders } from "./sample-data";

describe("preview sample data", () => {
  it("is deterministic for a given seed", () => {
    expect(sampleOrders(10, 3)).toEqual(sampleOrders(10, 3));
    expect(sampleOrders(10, 3)).not.toEqual(sampleOrders(10, 4));
  });

  it("produces unique order ids and numbers", () => {
    const orders = sampleOrders();
    expect(new Set(orders.map((o) => o.id)).size).toBe(orders.length);
    expect(new Set(orders.map((o) => o.number)).size).toBe(orders.length);
    expect(orders.every((o) => /^SO-2026-\d{5}$/.test(o.number))).toBe(true);
  });

  it("keeps paid ratios consistent with status", () => {
    for (const o of sampleOrders()) {
      if (o.status === "DRAFT" || o.status === "CANCELLED") expect(o.paidRatio).toBe(0);
      if (o.status === "CLOSED" || o.status === "SHIPPED") expect(o.paidRatio).toBe(1);
      expect(o.paidRatio).toBeGreaterThanOrEqual(0);
      expect(o.paidRatio).toBeLessThanOrEqual(1);
    }
  });

  it("random helpers stay in range", () => {
    const r = createRandom(1);
    for (let i = 0; i < 200; i++) {
      const n = r.int(3, 5);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(5);
    }
  });

  it("resolves a shell context only for known orgs", () => {
    const ctx = previewShellContext("demo");
    expect(ctx?.basePath).toBe("/preview/demo");
    expect(ctx?.preview).toBe(true);
    expect(ctx?.permissions).toEqual(ALL_PERMISSIONS);
    expect(previewShellContext("nope")).toBeNull();
  });

  it("maps module paths to roadmap phases", () => {
    expect(moduleForPath(["crm", "leads"])?.phase).toBe(6);
    expect(moduleForPath(["copilot"])?.phase).toBe(21);
    expect(moduleForPath(["unknown"])).toBeUndefined();
    expect(moduleForPath([])).toBeUndefined();
  });
});
