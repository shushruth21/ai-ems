import type { Permission } from "@ai-ems/security/authorization/permissions";

export interface QuickAction {
  id: string;
  title: string;
  href: string;
  permission: Permission;
  keywords: string[];
}

/** "Create …" entries in the command palette, filtered by permission. */
export const quickActions: readonly QuickAction[] = [
  {
    id: "new-lead",
    title: "New lead",
    href: "/crm/leads/new",
    permission: "crm.lead.write",
    keywords: ["prospect"],
  },
  {
    id: "new-quote",
    title: "New quote",
    href: "/sales/quotes/new",
    permission: "sales.quote.write",
    keywords: ["estimate"],
  },
  {
    id: "new-order",
    title: "New sales order",
    href: "/sales/orders/new",
    permission: "sales.order.write",
    keywords: ["so"],
  },
  {
    id: "new-po",
    title: "New purchase order",
    href: "/procurement/purchase-orders/new",
    permission: "procurement.po.write",
    keywords: ["po", "buy"],
  },
  {
    id: "new-work-order",
    title: "New work order",
    href: "/production/work-orders/new",
    permission: "production.workorder.write",
    keywords: ["wo", "production"],
  },
];
