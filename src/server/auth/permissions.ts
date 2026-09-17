/**
 * Permission catalog — the single source of truth, seeded into `permissions`.
 * Keys follow `<module>.<resource>.<action>`.
 */
export const PERMISSIONS = {
  // Platform
  "platform.settings.manage": "Manage organization settings",
  "platform.members.manage": "Invite, suspend and change member roles",
  "platform.roles.manage": "Create and edit roles",
  "platform.audit.read": "View the audit log",
  "platform.billing.manage": "Manage subscription and billing",
  // CRM
  "crm.lead.read": "View leads",
  "crm.lead.write": "Create and edit leads",
  "crm.lead.assign": "Reassign leads",
  "crm.account.read": "View accounts and contacts",
  "crm.account.write": "Create and edit accounts and contacts",
  "crm.contact.reveal": "Reveal masked contact details",
  // Catalog
  "catalog.product.read": "View products",
  "catalog.product.write": "Create and edit products, options and price rules",
  // Sales
  "sales.quote.read": "View quotes",
  "sales.quote.write": "Create and edit quotes",
  "sales.quote.approve": "Approve quotes above discount policy",
  "sales.order.read": "View sales orders",
  "sales.order.write": "Create and edit sales orders",
  "sales.order.confirm": "Confirm sales orders",
  "sales.order.cancel": "Cancel sales orders",
  "sales.payment.record": "Record customer payments",
  // Inventory
  "inventory.stock.read": "View stock",
  "inventory.stock.move": "Post stock movements",
  "inventory.stock.adjust": "Post stock adjustments",
  "inventory.item.write": "Create and edit items and warehouses",
  // Procurement
  "procurement.po.read": "View purchase orders",
  "procurement.po.write": "Create and edit purchase orders",
  "procurement.po.approve": "Approve purchase orders",
  "procurement.receipt.write": "Receive goods",
  "procurement.supplier.write": "Manage suppliers",
  // Production
  "production.bom.write": "Create and edit BOMs",
  "production.bom.approve": "Approve BOMs",
  "production.workorder.read": "View work orders",
  "production.workorder.write": "Plan and release work orders",
  "production.operation.execute": "Start and complete operations (kiosk)",
  // Quality
  "quality.inspection.read": "View inspections",
  "quality.inspection.perform": "Perform inspections",
  "quality.ncr.manage": "Manage non-conformances",
  // Fulfillment
  "fulfillment.shipment.read": "View shipments",
  "fulfillment.shipment.write": "Pack, schedule and deliver shipments",
  // Finance
  "finance.invoice.read": "View invoices",
  "finance.invoice.write": "Create and issue invoices",
  // AI
  "ai.copilot.use": "Use the AI copilot",
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export function moduleOf(permission: Permission): string {
  return permission.split(".")[0]!;
}

/** Default role templates created for every new organization. */
export const SYSTEM_ROLES: Record<string, { name: string; permissions: Permission[] | "*" }> = {
  owner: { name: "Owner", permissions: "*" },
  admin: {
    name: "Administrator",
    permissions: ALL_PERMISSIONS.filter((p) => p !== "platform.billing.manage"),
  },
  sales_rep: {
    name: "Sales Representative",
    permissions: [
      "crm.lead.read",
      "crm.lead.write",
      "crm.account.read",
      "crm.account.write",
      "catalog.product.read",
      "sales.quote.read",
      "sales.quote.write",
      "sales.order.read",
      "sales.order.write",
      "sales.payment.record",
      "inventory.stock.read",
      "fulfillment.shipment.read",
      "ai.copilot.use",
    ],
  },
  sales_manager: {
    name: "Sales Manager",
    permissions: [
      "crm.lead.read",
      "crm.lead.write",
      "crm.lead.assign",
      "crm.account.read",
      "crm.account.write",
      "crm.contact.reveal",
      "catalog.product.read",
      "sales.quote.read",
      "sales.quote.write",
      "sales.quote.approve",
      "sales.order.read",
      "sales.order.write",
      "sales.order.confirm",
      "sales.order.cancel",
      "sales.payment.record",
      "inventory.stock.read",
      "fulfillment.shipment.read",
      "finance.invoice.read",
      "ai.copilot.use",
    ],
  },
  buyer: {
    name: "Buyer",
    permissions: [
      "procurement.po.read",
      "procurement.po.write",
      "procurement.supplier.write",
      "inventory.stock.read",
      "catalog.product.read",
      "ai.copilot.use",
    ],
  },
  warehouse: {
    name: "Warehouse Operator",
    permissions: [
      "inventory.stock.read",
      "inventory.stock.move",
      "procurement.po.read",
      "procurement.receipt.write",
      "fulfillment.shipment.read",
      "fulfillment.shipment.write",
    ],
  },
  planner: {
    name: "Production Planner",
    permissions: [
      "production.bom.write",
      "production.workorder.read",
      "production.workorder.write",
      "inventory.stock.read",
      "sales.order.read",
      "catalog.product.read",
      "ai.copilot.use",
    ],
  },
  operator: {
    name: "Shop-floor Operator",
    permissions: ["production.workorder.read", "production.operation.execute"],
  },
  inspector: {
    name: "Quality Inspector",
    permissions: [
      "quality.inspection.read",
      "quality.inspection.perform",
      "quality.ncr.manage",
      "production.workorder.read",
      "procurement.po.read",
    ],
  },
  finance: {
    name: "Finance",
    permissions: [
      "finance.invoice.read",
      "finance.invoice.write",
      "sales.order.read",
      "sales.payment.record",
      "procurement.po.read",
      "ai.copilot.use",
    ],
  },
  viewer: {
    name: "Read-only",
    permissions: ALL_PERMISSIONS.filter((p) => p.endsWith(".read")),
  },
};

export function resolveRolePermissions(roleKey: string): Permission[] {
  const role = SYSTEM_ROLES[roleKey];
  if (!role) return [];
  return role.permissions === "*" ? [...ALL_PERMISSIONS] : role.permissions;
}
