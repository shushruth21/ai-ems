import { ALL_PERMISSIONS } from "@ai-ems/security/authorization/permissions";
import type { ShellContextValue, ShellOrganization } from "@/types/shell";

/**
 * Deterministic, fictional sample data for the /preview sandbox and tests.
 * Every name is invented; nothing is loaded from a database.
 */

/** Small seeded PRNG (mulberry32) so renders and tests are stable. */
export function createRandom(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
  };
}

export const PREVIEW_ORGANIZATIONS: ShellOrganization[] = [
  { id: "org_demo", slug: "demo", name: "Demo Industries", plan: "GROWTH" },
  { id: "org_north", slug: "harborline", name: "Harborline Workshop", plan: "STARTER" },
];

export function previewShellContext(orgSlug: string): ShellContextValue | null {
  const organization = PREVIEW_ORGANIZATIONS.find((o) => o.slug === orgSlug);
  if (!organization) return null;
  return {
    user: {
      id: "usr_preview",
      name: "Riley Morgan",
      email: "riley@demo-industries.example",
      title: "Operations lead",
    },
    organization,
    organizations: PREVIEW_ORGANIZATIONS,
    permissions: ALL_PERMISSIONS,
    basePath: `/preview/${organization.slug}`,
    preview: true,
  };
}

export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "READY"
  | "PARTIALLY_SHIPPED"
  | "SHIPPED"
  | "CLOSED"
  | "CANCELLED";

export interface SampleOrder {
  id: string;
  number: string;
  customer: string;
  owner: string;
  status: OrderStatus;
  total: number;
  paidRatio: number;
  promisedDate: string;
  createdAt: string;
  lines: number;
}

const CUSTOMERS = [
  "Brightline Offices",
  "Harbor View Hotels",
  "Maple & Co. Studio",
  "Crescent Clinics",
  "Summit Coworking",
  "Riverside Dental",
  "Atlas Hospitality",
  "Pinecrest Schools",
  "Lumen Retail Group",
  "Oakridge Residences",
  "Northgate Partners",
  "Solstice Cafés",
];
const OWNERS = ["Riley Morgan", "Sam Okafor", "Priya Nair", "Diego Alvarez", "Mei Tanaka"];
const STATUSES: readonly OrderStatus[] = [
  "DRAFT",
  "CONFIRMED",
  "CONFIRMED",
  "IN_PRODUCTION",
  "IN_PRODUCTION",
  "IN_PRODUCTION",
  "READY",
  "PARTIALLY_SHIPPED",
  "SHIPPED",
  "CLOSED",
  "CANCELLED",
];

const REFERENCE_DATE = Date.UTC(2026, 8, 15);
const DAY = 86_400_000;

export function sampleOrders(count = 64, seed = 7): SampleOrder[] {
  const rnd = createRandom(seed);
  return Array.from({ length: count }, (_, i) => {
    const created = REFERENCE_DATE - rnd.int(0, 120) * DAY;
    const status = rnd.pick(STATUSES);
    const total = rnd.int(18, 420) * 50;
    const paidRatio =
      status === "CLOSED" || status === "SHIPPED"
        ? 1
        : status === "DRAFT" || status === "CANCELLED"
          ? 0
          : rnd.int(3, 8) / 10;
    return {
      id: `so_${i + 1}`,
      number: `SO-2026-${String(count - i).padStart(5, "0")}`,
      customer: rnd.pick(CUSTOMERS),
      owner: rnd.pick(OWNERS),
      status,
      total,
      paidRatio,
      promisedDate: new Date(created + rnd.int(14, 45) * DAY).toISOString(),
      createdAt: new Date(created).toISOString(),
      lines: rnd.int(1, 9),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const sampleRevenueTrend = [42, 45, 44, 51, 49, 55, 58, 54, 61, 66, 64, 71];

export const sampleWorkCenters = [
  { name: "Cutting", load: 0.62 },
  { name: "Assembly", load: 0.91 },
  { name: "Finishing", load: 0.74 },
  { name: "Packing", load: 0.38 },
];
