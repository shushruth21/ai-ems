import {
  Blocks,
  Boxes,
  Building2,
  ChartLine,
  ClipboardCheck,
  Contact,
  Factory,
  FileText,
  Handshake,
  Headset,
  Inbox,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  Megaphone,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tags,
  Truck,
  UserCog,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

import type { Permission } from "@ai-ems/security/authorization/permissions";

export interface NavItem {
  id: string;
  title: string;
  /** Path relative to the workspace base, e.g. "/sales/orders". */
  href: string;
  icon: LucideIcon;
  /** Hidden unless the user holds this permission. Omit for "any member". */
  permission?: Permission;
  /** Extra search terms for the command palette. */
  keywords?: string[];
  /** Second key of a "g <key>" navigation shortcut. */
  shortcut?: string;
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

export const NAVIGATION: readonly NavSection[] = [
  {
    id: "workspace",
    title: "Workspace",
    items: [
      {
        id: "dashboard",
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        shortcut: "h",
        keywords: ["home", "overview"],
      },
      {
        id: "inbox",
        title: "Inbox",
        href: "/inbox",
        icon: Inbox,
        keywords: ["notifications", "mentions"],
      },
      {
        id: "tasks",
        title: "My tasks",
        href: "/tasks",
        icon: ListTodo,
        shortcut: "t",
        keywords: ["todo"],
      },
      {
        id: "copilot",
        title: "AI Copilot",
        href: "/copilot",
        icon: Sparkles,
        permission: "ai.copilot.use",
        keywords: ["assistant", "ask", "ai"],
      },
    ],
  },
  {
    id: "sell",
    title: "Sell",
    items: [
      {
        id: "leads",
        title: "Leads",
        href: "/crm/leads",
        icon: Contact,
        permission: "crm.lead.read",
        shortcut: "l",
        keywords: ["crm", "prospects"],
      },
      {
        id: "accounts",
        title: "Accounts",
        href: "/crm/accounts",
        icon: Building2,
        permission: "crm.account.read",
        keywords: ["customers", "companies", "contacts"],
      },
      {
        id: "quotes",
        title: "Quotes",
        href: "/sales/quotes",
        icon: FileText,
        permission: "sales.quote.read",
        shortcut: "q",
        keywords: ["estimates", "proposals"],
      },
      {
        id: "orders",
        title: "Sales orders",
        href: "/sales/orders",
        icon: ShoppingCart,
        permission: "sales.order.read",
        shortcut: "o",
        keywords: ["so", "bookings"],
      },
      {
        id: "catalog",
        title: "Catalog",
        href: "/catalog/products",
        icon: Tags,
        permission: "catalog.product.read",
        keywords: ["products", "configurator", "pricing"],
      },
    ],
  },
  {
    id: "make",
    title: "Make",
    items: [
      {
        id: "work-orders",
        title: "Work orders",
        href: "/production/work-orders",
        icon: Factory,
        permission: "production.workorder.read",
        shortcut: "w",
        keywords: ["production", "manufacturing", "schedule"],
      },
      {
        id: "boms",
        title: "Bills of materials",
        href: "/production/boms",
        icon: Blocks,
        permission: "production.bom.write",
        keywords: ["bom", "engineering", "routing"],
      },
      {
        id: "quality",
        title: "Quality",
        href: "/quality/inspections",
        icon: ClipboardCheck,
        permission: "quality.inspection.read",
        keywords: ["qc", "inspections", "ncr"],
      },
    ],
  },
  {
    id: "source",
    title: "Source & stock",
    items: [
      {
        id: "inventory",
        title: "Inventory",
        href: "/inventory/items",
        icon: Boxes,
        permission: "inventory.stock.read",
        shortcut: "i",
        keywords: ["stock", "items", "materials"],
      },
      {
        id: "warehouses",
        title: "Warehouses",
        href: "/inventory/warehouses",
        icon: Warehouse,
        permission: "inventory.stock.read",
        keywords: ["locations"],
      },
      {
        id: "purchasing",
        title: "Purchasing",
        href: "/procurement/purchase-orders",
        icon: Package,
        permission: "procurement.po.read",
        shortcut: "p",
        keywords: ["po", "suppliers", "procurement"],
      },
    ],
  },
  {
    id: "deliver",
    title: "Deliver & bill",
    items: [
      {
        id: "shipments",
        title: "Shipments",
        href: "/fulfillment/shipments",
        icon: Truck,
        permission: "fulfillment.shipment.read",
        keywords: ["delivery", "logistics", "dispatch"],
      },
      {
        id: "invoices",
        title: "Invoices",
        href: "/finance/invoices",
        icon: Receipt,
        permission: "finance.invoice.read",
        keywords: ["billing", "receivables"],
      },
      {
        id: "payments",
        title: "Payments",
        href: "/finance/payments",
        icon: Wallet,
        permission: "finance.invoice.read",
        keywords: ["collections", "cash"],
      },
    ],
  },
  {
    id: "grow",
    title: "Grow",
    items: [
      {
        id: "service",
        title: "Service",
        href: "/service/tickets",
        icon: Headset,
        keywords: ["support", "tickets", "warranty"],
      },
      {
        id: "partners",
        title: "Partners",
        href: "/partners",
        icon: Handshake,
        keywords: ["referrals", "commissions"],
      },
      {
        id: "marketing",
        title: "Marketing",
        href: "/marketing",
        icon: Megaphone,
        keywords: ["campaigns"],
      },
      {
        id: "people",
        title: "People",
        href: "/people/employees",
        icon: Users,
        keywords: ["hr", "employees", "attendance"],
      },
      {
        id: "analytics",
        title: "Analytics",
        href: "/analytics",
        icon: ChartLine,
        keywords: ["reports", "kpi", "insights"],
      },
    ],
  },
  {
    id: "admin",
    title: "Administration",
    items: [
      {
        id: "members",
        title: "Members & roles",
        href: "/settings/members",
        icon: UserCog,
        permission: "platform.members.manage",
        keywords: ["users", "invite", "permissions"],
      },
      {
        id: "roles",
        title: "Roles & permissions",
        href: "/settings/roles",
        icon: ShieldCheck,
        permission: "platform.roles.manage",
        keywords: ["roles", "permissions", "access"],
      },
      {
        id: "audit",
        title: "Audit log",
        href: "/settings/audit",
        icon: ScrollText,
        permission: "platform.audit.read",
        keywords: ["history", "events", "compliance"],
      },
      {
        id: "api-keys",
        title: "API keys",
        href: "/settings/api-keys",
        icon: KeyRound,
        permission: "platform.settings.manage",
        keywords: ["api", "tokens", "integrations"],
      },
      {
        id: "settings",
        title: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "platform.settings.manage",
        shortcut: "s",
        keywords: ["preferences", "organization"],
      },
    ],
  },
];

/** Removes items the user may not see, then empty sections. */
export function filterNavigation(
  sections: readonly NavSection[],
  permissions: ReadonlySet<string>,
): NavSection[] {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || permissions.has(item.permission)),
    }))
    .filter((section) => section.items.length > 0);
}

export function joinPath(basePath: string, href: string): string {
  const base = basePath.replace(/\/+$/, "");
  const path = href.startsWith("/") ? href : `/${href}`;
  return `${base}${path}` || "/";
}

/** Longest-prefix match of the current path against visible items. */
export function findActiveItem(
  sections: readonly NavSection[],
  pathname: string,
  basePath: string,
): NavItem | undefined {
  let best: NavItem | undefined;
  let bestLength = -1;
  for (const item of sections.flatMap((s) => s.items)) {
    const full = joinPath(basePath, item.href);
    const matches = pathname === full || pathname.startsWith(`${full}/`);
    if (matches && full.length > bestLength) {
      best = item;
      bestLength = full.length;
    }
  }
  return best;
}

export interface Crumb {
  label: string;
  href?: string;
}

/** Section › item › (remaining segments, title-cased). */
export function breadcrumbsFor(
  sections: readonly NavSection[],
  pathname: string,
  basePath: string,
): Crumb[] {
  const item = findActiveItem(sections, pathname, basePath);
  if (!item) return [];
  const section = sections.find((s) => s.items.includes(item));
  const itemHref = joinPath(basePath, item.href);
  const rest = pathname
    .slice(itemHref.length)
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const crumbs: Crumb[] = [];
  if (section && section.id !== "workspace") crumbs.push({ label: section.title });
  crumbs.push({ label: item.title, href: rest.length ? itemHref : undefined });
  rest.forEach((segment, i) => {
    const label = /^[A-Z]{2,5}-/.test(segment)
      ? segment
      : segment.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
    const href = i < rest.length - 1 ? `${itemHref}/${rest.slice(0, i + 1).join("/")}` : undefined;
    crumbs.push({ label, href });
  });
  return crumbs;
}

/** "g <key>" bindings derived from the visible navigation. */
export function navigationShortcuts(
  sections: readonly NavSection[],
): { keys: string; item: NavItem }[] {
  return sections
    .flatMap((s) => s.items)
    .filter((item): item is NavItem & { shortcut: string } => Boolean(item.shortcut))
    .map((item) => ({ keys: `g ${item.shortcut}`, item }));
}
