import { statusLabel, statusTone } from "./status";

describe("status", () => {
  it.each([
    ["DRAFT", "neutral"],
    ["PENDING_APPROVAL", "warning"],
    ["IN_PRODUCTION", "info"],
    ["DELIVERED", "success"],
    ["CANCELLED", "danger"],
    ["something_unknown", "neutral"],
    ["shipped", "success"],
  ] as const)("%s → %s", (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });

  it("humanizes status codes", () => {
    expect(statusLabel("PARTIALLY_SHIPPED")).toBe("Partially shipped");
    expect(statusLabel("PENDING_APPROVAL")).toBe("Pending approval");
    expect(statusLabel("NEW")).toBe("New");
    expect(statusLabel("")).toBe("");
  });

  it("covers every Prisma workflow status", async () => {
    const enums = await import("@/generated/prisma/enums");
    const workflowEnums = [
      "QuoteStatus",
      "SalesOrderStatus",
      "PurchaseOrderStatus",
      "WorkOrderStatus",
      "OperationStatus",
      "InspectionResult",
      "ShipmentStatus",
      "InvoiceStatus",
      "TaskStatus",
      "LeadStatus",
      "BomStatus",
      "ReceiptStatus",
    ] as const;
    const known = new Set([
      // intentionally neutral
      "DRAFT",
      "NEW",
      "PLANNED",
      "PENDING",
      "TODO",
      "OBSOLETE",
    ]);
    for (const name of workflowEnums) {
      const values = Object.values((enums as Record<string, Record<string, string>>)[name] ?? {});
      expect(values.length, name).toBeGreaterThan(0);
      for (const v of values) {
        if (known.has(v)) continue;
        expect(statusTone(v), `${name}.${v} needs a tone`).not.toBe("neutral");
      }
    }
  });
});
