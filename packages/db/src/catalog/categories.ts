import { recordAudit } from "../platform/audit";
import {
  platformClient,
  PlatformError,
  type CrmActor as CatalogActor,
  type CrmDb as CatalogDb,
} from "../crm/types";

export interface CategoryInput {
  code: string;
  name: string;
  parentId?: string | null;
  sortOrder: number;
}

export interface CategoryRow {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  sortOrder: number;
  productCount: number;
}

export async function listCategories(db: CatalogDb): Promise<CategoryRow[]> {
  const rows = await db.productCategory.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 500,
    select: {
      id: true,
      code: true,
      name: true,
      parentId: true,
      sortOrder: true,
      parent: { select: { name: true } },
      _count: { select: { products: true } },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    parentId: c.parentId,
    parentName: c.parent?.name ?? null,
    sortOrder: c.sortOrder,
    productCount: c._count.products,
  }));
}

/**
 * A category may not become its own ancestor — that would make the tree
 * unwalkable and the breadcrumbs infinite.
 */
async function assertNoCycle(
  db: CatalogDb,
  categoryId: string,
  parentId: string | null,
): Promise<void> {
  let cursor = parentId;
  for (let depth = 0; cursor && depth < 20; depth++) {
    if (cursor === categoryId) {
      throw new PlatformError("invalid_state", "A category can't sit inside itself.");
    }
    const parent: { parentId: string | null } | null = await db.productCategory.findFirst({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
}

export async function createCategory(
  db: CatalogDb,
  actor: CatalogActor,
  input: CategoryInput,
): Promise<{ id: string }> {
  const taken = await db.productCategory.findFirst({
    where: { code: input.code },
    select: { id: true },
  });
  if (taken) throw new PlatformError("invalid_state", `Code ${input.code} is already in use.`);

  const category = await db.productCategory.create({
    data: {
      organizationId: actor.organizationId,
      code: input.code,
      name: input.name,
      parentId: input.parentId || null,
      sortOrder: input.sortOrder,
    },
    select: { id: true },
  });
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "category.created",
    entityType: "product_category",
    entityId: category.id,
    changes: { code: input.code, name: input.name },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return category;
}

export async function updateCategory(
  db: CatalogDb,
  actor: CatalogActor,
  categoryId: string,
  input: CategoryInput,
): Promise<void> {
  await assertNoCycle(db, categoryId, input.parentId || null);
  const taken = await db.productCategory.findFirst({
    where: { code: input.code, NOT: { id: categoryId } },
    select: { id: true },
  });
  if (taken) throw new PlatformError("invalid_state", `Code ${input.code} is already in use.`);

  const { count } = await db.productCategory.updateMany({
    where: { id: categoryId },
    data: {
      code: input.code,
      name: input.name,
      parentId: input.parentId || null,
      sortOrder: input.sortOrder,
    },
  });
  if (count === 0) throw new PlatformError("not_found", "Category not found.");
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "category.updated",
    entityType: "product_category",
    entityId: categoryId,
    changes: { code: input.code, name: input.name },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}

/** Categories with products (or children) are deactivated, not removed. */
export async function archiveCategory(
  db: CatalogDb,
  actor: CatalogActor,
  categoryId: string,
): Promise<void> {
  const products = await db.product.count({ where: { categoryId } });
  if (products > 0) {
    throw new PlatformError(
      "invalid_state",
      `Move ${products} ${products === 1 ? "product" : "products"} to another category first.`,
    );
  }
  const children = await db.productCategory.count({ where: { parentId: categoryId } });
  if (children > 0) {
    throw new PlatformError("invalid_state", "Move or remove the sub-categories first.");
  }
  const { count } = await db.productCategory.updateMany({
    where: { id: categoryId, active: true },
    data: { active: false },
  });
  if (count === 0) throw new PlatformError("not_found", "Category not found.");
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "category.archived",
    entityType: "product_category",
    entityId: categoryId,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}
