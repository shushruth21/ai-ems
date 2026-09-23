import { randomBytes, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { ALL_PERMISSIONS, moduleOf, PERMISSIONS } from "@ai-ems/security/authorization/permissions";

import {
  archiveCategory,
  createCategory,
  listCategories,
  updateCategory,
} from "../../src/catalog/categories";
import { deleteOptionGroup, saveOption, saveOptionGroup } from "../../src/catalog/options";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  transitionProduct,
  updateProduct,
} from "../../src/catalog/products";
import { PrismaClient } from "../../src/generated/prisma/client";
import { provisionOrganization } from "../../src/platform/organizations";
import { scopeToTenant } from "../../src/tenant-client";

/**
 * Catalog repositories against the real migrations: SKU and code uniqueness,
 * the publish gate, and the tree rules that only a database can prove.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const migrationsDir = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));

describe.skipIf(!adminUrl)("catalog repositories (real schema)", () => {
  const dbName = `aiems_catalog_${randomBytes(4).toString("hex")}`;
  let admin: pg.Client;
  let root: PrismaClient;
  let orgId: string;
  let ownerId: string;
  let seatingId: string;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    const setup = new pg.Client({ connectionString: url.toString() });
    await setup.connect();
    for (const dir of readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()) {
      await setup.query(readFileSync(`${migrationsDir}/${dir}/migration.sql`, "utf8"));
    }
    for (const key of ALL_PERMISSIONS) {
      await setup.query("insert into permissions (key, module, description) values ($1, $2, $3)", [
        key,
        moduleOf(key),
        PERMISSIONS[key],
      ]);
    }
    await setup.end();
    root = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });

    ownerId = randomUUID();
    const org = await provisionOrganization(root, {
      name: "Catalog Co",
      slug: `cat-${randomBytes(3).toString("hex")}`,
      currency: "USD",
      timezone: "UTC",
      owner: { id: ownerId, email: `owner.${randomBytes(3).toString("hex")}@example.test` },
    });
    orgId = org.id;
    const seating = await createCategory(db(), actor(), {
      code: "SEATING",
      name: "Seating",
      sortOrder: 0,
    });
    seatingId = seating.id;
  });

  afterAll(async () => {
    await root?.$disconnect();
    await admin?.query(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  const actor = () => ({ organizationId: orgId, profileId: ownerId, canAssign: true });
  const db = () => scopeToTenant(root, orgId);
  const productInput = (over: Partial<Parameters<typeof createProduct>[2]> = {}) => ({
    sku: "SOFA-3S",
    name: "Three-seat sofa",
    categoryId: seatingId,
    basePrice: 1200,
    taxRatePct: 7.5,
    leadTimeDays: 21,
    isConfigurable: false,
    ...over,
  });

  it("keeps SKUs unique within the workspace", async () => {
    const product = await createProduct(db(), actor(), productInput());
    await expect(createProduct(db(), actor(), productInput())).rejects.toMatchObject({
      code: "invalid_state",
    });
    // Renaming to another product's SKU is refused too.
    const second = await createProduct(
      db(),
      actor(),
      productInput({ sku: "SOFA-2S", name: "Two-seat sofa" }),
    );
    await expect(
      updateProduct(db(), actor(), second.id, productInput({ name: "Two-seat sofa" })),
    ).rejects.toMatchObject({ code: "invalid_state" });
    expect((await listProducts(db())).map((p) => p.sku).sort()).toEqual(["SOFA-2S", "SOFA-3S"]);
    expect((await getProduct(db(), product.id))?.categoryName).toBe("Seating");
  });

  it("won't publish a configurable product until its options exist", async () => {
    const { id } = await createProduct(
      db(),
      actor(),
      productInput({ sku: "SOFA-CFG", name: "Configurable sofa", isConfigurable: true }),
    );
    await expect(transitionProduct(db(), actor(), id, "publish")).rejects.toMatchObject({
      code: "invalid_state",
    });

    const group = await saveOptionGroup(db(), actor(), {
      productId: id,
      label: "Fabric colour",
      input: "SELECT",
      required: true,
      sortOrder: 0,
    });
    // A choice list with nothing to choose still blocks publishing.
    await expect(transitionProduct(db(), actor(), id, "publish")).rejects.toMatchObject({
      code: "invalid_state",
    });

    await saveOption(db(), actor(), {
      groupId: group.id,
      label: "Olive velvet",
      priceDelta: 150,
      pricePctDelta: 0,
      sortOrder: 0,
    });
    expect(await transitionProduct(db(), actor(), id, "publish")).toEqual({ status: "ACTIVE" });

    const detail = (await getProduct(db(), id))!;
    expect(detail.groups[0]?.code).toBe("fabric_colour");
    expect(detail.groups[0]?.options[0]?.priceDelta).toBe(150);
    expect(detail.availableActions.sort()).toEqual(["discontinue", "unpublish"]);
  });

  it("generates unique codes and refuses options on free-text groups", async () => {
    const { id } = await createProduct(
      db(),
      actor(),
      productInput({ sku: "DESK-1", name: "Desk", isConfigurable: true }),
    );
    const first = await saveOptionGroup(db(), actor(), {
      productId: id,
      label: "Finish",
      input: "SELECT",
      required: false,
      sortOrder: 0,
    });
    const second = await saveOptionGroup(db(), actor(), {
      productId: id,
      label: "Finish",
      input: "SELECT",
      required: false,
      sortOrder: 1,
    });
    const detail = (await getProduct(db(), id))!;
    const codes = detail.groups.map((g) => g.code).sort();
    expect(codes).toEqual(["finish", "finish_2"]);

    const notes = await saveOptionGroup(db(), actor(), {
      productId: id,
      label: "Engraving text",
      input: "TEXT",
      required: false,
      sortOrder: 2,
    });
    await expect(
      saveOption(db(), actor(), {
        groupId: notes.id,
        label: "Anything",
        priceDelta: 0,
        pricePctDelta: 0,
        sortOrder: 0,
      }),
    ).rejects.toMatchObject({ code: "invalid_state" });

    // A numeric group with an upside-down range is refused.
    await expect(
      saveOptionGroup(db(), actor(), {
        productId: id,
        label: "Width",
        input: "NUMBER",
        required: false,
        minValue: 300,
        maxValue: 40,
        sortOrder: 3,
      }),
    ).rejects.toMatchObject({ code: "invalid_state" });

    await deleteOptionGroup(db(), actor(), second.id);
    await deleteOptionGroup(db(), actor(), first.id);
    expect((await getProduct(db(), id))!.groups.map((g) => g.label)).toEqual(["Engraving text"]);
  });

  it("deletes only unused drafts", async () => {
    const { id } = await createProduct(
      db(),
      actor(),
      productInput({ sku: "TEMP-1", name: "Temp" }),
    );
    await transitionProduct(db(), actor(), id, "publish");
    await expect(deleteProduct(db(), actor(), id)).rejects.toMatchObject({
      code: "invalid_state",
    });
    await transitionProduct(db(), actor(), id, "unpublish");
    await deleteProduct(db(), actor(), id);
    expect(await getProduct(db(), id)).toBeNull();
  });

  it("keeps the category tree sane", async () => {
    const child = await createCategory(db(), actor(), {
      code: "SOFAS",
      name: "Sofas",
      parentId: seatingId,
      sortOrder: 1,
    });
    expect((await listCategories(db())).find((c) => c.id === child.id)?.parentName).toBe("Seating");

    // A category can't be moved inside itself or its own descendant.
    await expect(
      updateCategory(db(), actor(), seatingId, {
        code: "SEATING",
        name: "Seating",
        parentId: child.id,
        sortOrder: 0,
      }),
    ).rejects.toMatchObject({ code: "invalid_state" });

    // Categories in use can't be removed.
    await expect(archiveCategory(db(), actor(), seatingId)).rejects.toMatchObject({
      code: "invalid_state",
    });
    await archiveCategory(db(), actor(), child.id);
    expect((await listCategories(db())).some((c) => c.id === child.id)).toBe(false);
  });

  it("writes an audit trail for catalog changes", async () => {
    const actions = (
      await root.auditEvent.findMany({
        where: { organizationId: orgId, entityType: { in: ["product", "option_group"] } },
        select: { action: true },
      })
    ).map((e) => e.action);
    expect(new Set(actions)).toEqual(
      new Set([
        "product.created",
        "product.publish",
        "product.unpublish",
        "product.deleted",
        "option_group.created",
        "option_group.deleted",
      ]),
    );
  });
});
