/**
 * Seeds the permission catalog and a fictional demo tenant ("Demo Industries")
 * with generic sample data. Safe to re-run (idempotent upserts).
 *
 *   npm run db:seed
 *
 * Optional: set SEED_OWNER_EMAIL + SEED_OWNER_PASSWORD (and Supabase keys) to
 * also create a login for the demo owner. No credentials are hard-coded.
 */
import "../load-env";

import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  ALL_PERMISSIONS,
  moduleOf,
  PERMISSIONS,
  SYSTEM_ROLES,
} from "@ai-ems/security/authorization/permissions";

import { provisionRolesAndSequences } from "../src/platform/organizations";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL! }),
});

const ORG_SLUG = "demo";

async function seedPermissions() {
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description: PERMISSIONS[key], module: moduleOf(key) },
      create: { key, description: PERMISSIONS[key], module: moduleOf(key) },
    });
  }
  console.log(`✓ ${ALL_PERMISSIONS.length} permissions`);
}

async function seedOrganization() {
  const org = await prisma.organization.upsert({
    where: { slug: ORG_SLUG },
    update: {},
    create: {
      slug: ORG_SLUG,
      name: "Demo Industries",
      legalName: "Demo Industries LLC",
      currency: "USD",
      timezone: "America/New_York",
      plan: "GROWTH",
    },
  });

  await provisionRolesAndSequences(prisma, org.id, new Date().getUTCFullYear());

  console.log(`✓ organization "${org.name}" with ${Object.keys(SYSTEM_ROLES).length} roles`);
  return org;
}

async function seedMasterData(organizationId: string) {
  const o = { organizationId };

  const warehouse = await prisma.warehouse.upsert({
    where: { organizationId_code: { organizationId, code: "MAIN" } },
    update: {},
    create: { ...o, code: "MAIN", name: "Main Warehouse", isDefault: true },
  });

  const centers = [
    ["CUT", "Cutting", 1],
    ["ASM", "Assembly", 2],
    ["FIN", "Finishing", 3],
    ["PKG", "Packing", 4],
  ] as const;
  for (const [code, name, sequence] of centers) {
    await prisma.workCenter.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: {},
      create: { ...o, code, name, sequence, capacityHrsDay: 16, costPerHour: 35 },
    });
  }

  const supplier = await prisma.supplier.upsert({
    where: { organizationId_code: { organizationId, code: "SUP-001" } },
    update: {},
    create: {
      ...o,
      code: "SUP-001",
      name: "Northside Materials Co.",
      email: "orders@northside.example",
      paymentTerms: "Net 30",
      rating: 4.5,
    },
  });

  const items = [
    ["RM-STEEL-TUBE", "Steel tube 25mm", "RAW_MATERIAL", "m", 4.2, 200],
    ["RM-OAK-BOARD", "Oak board 18mm", "RAW_MATERIAL", "sqm", 38.5, 80],
    ["RM-FABRIC-STD", "Upholstery fabric (standard)", "RAW_MATERIAL", "m", 12.0, 150],
    ["CMP-FOAM-HD", "High-density foam block", "COMPONENT", "pcs", 22.0, 60],
    ["CMP-HARDWARE-KIT", "Fastener kit", "COMPONENT", "kit", 3.1, 300],
    ["CON-GLUE", "Wood adhesive", "CONSUMABLE", "l", 6.8, 40],
  ] as const;
  for (const [code, name, type, uom, cost, qty] of items) {
    const item = await prisma.item.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: {},
      create: {
        ...o,
        code,
        name,
        type,
        uom,
        standardCost: cost,
        reorderPoint: Math.round(qty / 4),
        reorderQty: qty,
        leadTimeDays: 7,
        preferredSupplierId: supplier.id,
      },
    });
    await prisma.stockLevel.upsert({
      where: { itemId_warehouseId: { itemId: item.id, warehouseId: warehouse.id } },
      update: {},
      create: { ...o, itemId: item.id, warehouseId: warehouse.id, onHand: qty },
    });
    await prisma.stockMovement.upsert({
      where: {
        organizationId_idempotencyKey: { organizationId, idempotencyKey: `seed-open-${code}` },
      },
      update: {},
      create: {
        ...o,
        itemId: item.id,
        warehouseId: warehouse.id,
        type: "OPENING_BALANCE",
        quantity: qty,
        unitCost: cost,
        balanceAfter: qty,
        referenceType: "seed",
        referenceId: "opening",
        idempotencyKey: `seed-open-${code}`,
      },
    });
  }

  const categories = [
    ["SEAT", "Seating"],
    ["TABLE", "Tables"],
    ["STORAGE", "Storage"],
  ] as const;
  const categoryIds: Record<string, string> = {};
  for (const [code, name] of categories) {
    const c = await prisma.productCategory.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: {},
      create: { ...o, code, name },
    });
    categoryIds[code] = c.id;
  }

  const products = [
    ["P-LOUNGE-CHAIR", "Aurora Lounge Chair", "SEAT", 640, true],
    ["P-DESK-120", "Contour Work Desk", "TABLE", 890, true],
    ["P-CABINET-3D", "Stack 3-Drawer Cabinet", "STORAGE", 420, false],
  ] as const;
  for (const [sku, name, cat, price, configurable] of products) {
    const product = await prisma.product.upsert({
      where: { organizationId_sku: { organizationId, sku } },
      update: {},
      create: {
        ...o,
        sku,
        name,
        categoryId: categoryIds[cat]!,
        status: "ACTIVE",
        isConfigurable: configurable,
        basePrice: price,
        taxRatePct: 8,
        leadTimeDays: 14,
        description: `${name} — made to order.`,
      },
    });
    if (!configurable) continue;
    const group = await prisma.optionGroup.upsert({
      where: { productId_code: { productId: product.id, code: "finish" } },
      update: {},
      create: { ...o, productId: product.id, code: "finish", label: "Finish", required: true },
    });
    const options = [
      ["natural", "Natural", 0],
      ["walnut", "Walnut stain", 60],
      ["black", "Matte black", 45],
    ] as const;
    for (const [code, label, delta] of options) {
      await prisma.productOption.upsert({
        where: { groupId_code: { groupId: group.id, code } },
        update: {},
        create: { ...o, groupId: group.id, code, label, priceDelta: delta },
      });
    }
  }

  await prisma.inspectionPlan.createMany({
    skipDuplicates: true,
    data: [
      {
        ...o,
        name: "Inbound material check",
        stage: "INBOUND",
        checklist: [
          { code: "qty", label: "Quantity matches delivery note", type: "check", critical: true },
          { code: "damage", label: "No visible damage", type: "check", critical: true },
        ],
      },
      {
        ...o,
        name: "Final product check",
        stage: "FINAL",
        checklist: [
          { code: "dims", label: "Overall width", type: "measure", unit: "cm", critical: true },
          { code: "finish", label: "Finish is even", type: "check", critical: false },
        ],
      },
    ],
  });

  const accounts = [
    ["Brightline Offices", "CUSTOMER", "Commercial interiors"],
    ["Harbor View Hotels", "PROSPECT", "Hospitality"],
    ["Maple & Co. Studio", "PARTNER", "Interior design"],
  ] as const;
  for (const [name, type, industry] of accounts) {
    const exists = await prisma.account.findFirst({ where: { organizationId, name } });
    if (!exists) await prisma.account.create({ data: { ...o, name, type, industry } });
  }

  console.log("✓ master data: warehouse, work centers, supplier, items, products, plans, accounts");
}

async function seedOwner(organizationId: string) {
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!email || !password || !url || !secret) {
    console.log("• skipped demo owner (set SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD to create one)");
    return;
  }
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Demo Owner" },
    });
    if (error) throw error;
    user = data.user;
  }
  // The local auth emulator can be reset, which re-creates the account with a
  // new id. Re-point the demo profile (and its memberships) at the new one.
  const stale = await prisma.profile.findUnique({ where: { email } });
  if (stale && stale.id !== user.id) {
    console.log(`• demo owner ${email} was re-created in Auth — replacing its profile`);
    await prisma.profile.delete({ where: { id: stale.id } });
  }
  await prisma.profile.upsert({
    where: { id: user.id },
    update: { email, fullName: "Demo Owner" },
    create: { id: user.id, email, fullName: "Demo Owner" },
  });
  const owner = await prisma.role.findUniqueOrThrow({
    where: { organizationId_key: { organizationId, key: "owner" } },
  });
  await prisma.membership.upsert({
    where: { organizationId_profileId: { organizationId, profileId: user.id } },
    update: { roleId: owner.id, status: "ACTIVE" },
    create: { organizationId, profileId: user.id, roleId: owner.id, title: "Owner" },
  });
  console.log(`✓ demo owner ${email}`);
}

async function main() {
  await seedPermissions();
  const org = await seedOrganization();
  await seedMasterData(org.id);
  await seedOwner(org.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
