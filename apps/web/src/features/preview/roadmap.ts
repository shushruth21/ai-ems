/** Which phase delivers a given module path (used by the preview placeholders). */
const ROADMAP: { prefix: string; title: string; phase: number; summary: string }[] = [
  {
    prefix: "settings",
    title: "Settings",
    phase: 5,
    summary: "Organization settings, members, roles, audit log and integrations.",
  },
  {
    prefix: "inbox",
    title: "Inbox",
    phase: 5,
    summary: "Mentions, approvals and alerts in one place.",
  },
  {
    prefix: "tasks",
    title: "My tasks",
    phase: 5,
    summary: "Tasks assigned to you across every module.",
  },
  {
    prefix: "crm",
    title: "CRM",
    phase: 6,
    summary: "Leads, accounts, contacts, activities and pipeline.",
  },
  {
    prefix: "catalog",
    title: "Catalog",
    phase: 7,
    summary: "Products, categories, options and price rules.",
  },
  {
    prefix: "sales",
    title: "Sales",
    phase: 9,
    summary: "Quotes, approvals, sales orders and payments.",
  },
  {
    prefix: "inventory",
    title: "Inventory",
    phase: 10,
    summary: "Items, warehouses, stock ledger, reservations and counts.",
  },
  {
    prefix: "procurement",
    title: "Purchasing",
    phase: 11,
    summary: "Requisitions, purchase orders, approvals and receipts.",
  },
  {
    prefix: "production",
    title: "Production",
    phase: 12,
    summary: "BOMs, work orders, scheduling and the shop-floor kiosk.",
  },
  {
    prefix: "quality",
    title: "Quality",
    phase: 13,
    summary: "Inspection plans, inspections and non-conformances.",
  },
  {
    prefix: "fulfillment",
    title: "Shipments",
    phase: 14,
    summary: "Packing, delivery scheduling and proof of delivery.",
  },
  {
    prefix: "finance",
    title: "Finance",
    phase: 15,
    summary: "Invoices, payments and collections.",
  },
  {
    prefix: "people",
    title: "People",
    phase: 16,
    summary: "Employees, attendance, leave and shifts.",
  },
  {
    prefix: "marketing",
    title: "Marketing",
    phase: 17,
    summary: "Campaigns, spend and attribution.",
  },
  {
    prefix: "service",
    title: "Service",
    phase: 18,
    summary: "Tickets, SLAs, warranty and field visits.",
  },
  {
    prefix: "partners",
    title: "Partners",
    phase: 19,
    summary: "Partner program, referrals and commission statements.",
  },
  {
    prefix: "analytics",
    title: "Analytics",
    phase: 20,
    summary: "Dashboards, saved reports and natural-language analytics.",
  },
  {
    prefix: "copilot",
    title: "AI Copilot",
    phase: 21,
    summary: "Ask questions and draft actions — every AI write needs your approval.",
  },
];

export function moduleForPath(segments: readonly string[]) {
  const first = segments[0] ?? "";
  return ROADMAP.find((r) => r.prefix === first);
}
