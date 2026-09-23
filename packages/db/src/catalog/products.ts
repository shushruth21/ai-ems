import {
  canDeleteProduct,
  canTransitionProduct,
  CATALOG_MESSAGES,
  productMachine,
  type CatalogResult,
  type ProductAction,
  type ProductStatus,
} from "@ai-ems/domain/catalog/product-policy";

import { recordAudit } from "../platform/audit";
import {
  platformClient,
  platformTx,
  PlatformError,
  type CrmActor as CatalogActor,
  type CrmDb as CatalogDb,
  type CrmTx as CatalogTx,
} from "../crm/types";

export type { CatalogActor, CatalogDb };

export interface ProductInput {
  sku: string;
  name: string;
  description?: string | null;
  categoryId: string;
  basePrice: number;
  taxRatePct: number;
  leadTimeDays: number;
  isConfigurable: boolean;
}

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  status: ProductStatus;
  categoryId: string;
  categoryName: string;
  basePrice: number;
  taxRatePct: number;
  leadTimeDays: number;
  isConfigurable: boolean;
  optionGroupCount: number;
  updatedAt: Date;
}

export interface OptionView {
  id: string;
  code: string;
  label: string;
  priceDelta: number;
  pricePctDelta: number;
  sortOrder: number;
  active: boolean;
}

export interface OptionGroupView {
  id: string;
  code: string;
  visibleWhen: { group: string; equals: string } | null;
  label: string;
  input: "SELECT" | "MULTI_SELECT" | "NUMBER" | "TEXT" | "BOOLEAN";
  required: boolean;
  minValue: number | null;
  maxValue: number | null;
  sortOrder: number;
  options: OptionView[];
}

export interface ProductDetail extends ProductRow {
  description: string | null;
  groups: OptionGroupView[];
  availableActions: ProductAction[];
}

function enforce(result: CatalogResult): void {
  if (result.ok) return;
  throw new PlatformError(
    result.reason === "in_use" ? "forbidden" : "invalid_state",
    CATALOG_MESSAGES[result.reason],
  );
}

const num = (value: { toString(): string } | null): number => (value ? Number(value) : 0);

export async function listProducts(
  db: CatalogDb,
  filters: { status?: ProductStatus; categoryId?: string; search?: string } = {},
): Promise<ProductRow[]> {
  const rows = await db.product.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" as const } },
              { sku: { contains: filters.search.toUpperCase() } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 500,
    select: {
      id: true,
      sku: true,
      name: true,
      status: true,
      categoryId: true,
      basePrice: true,
      taxRatePct: true,
      leadTimeDays: true,
      isConfigurable: true,
      updatedAt: true,
      category: { select: { name: true } },
      _count: { select: { optionGroups: true } },
    },
  });
  return rows.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    status: p.status,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    basePrice: num(p.basePrice),
    taxRatePct: num(p.taxRatePct),
    leadTimeDays: p.leadTimeDays,
    isConfigurable: p.isConfigurable,
    optionGroupCount: p._count.optionGroups,
    updatedAt: p.updatedAt,
  }));
}

export async function getProduct(db: CatalogDb, productId: string): Promise<ProductDetail | null> {
  const product = await db.product.findFirst({
    where: { id: productId },
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      status: true,
      categoryId: true,
      basePrice: true,
      taxRatePct: true,
      leadTimeDays: true,
      isConfigurable: true,
      updatedAt: true,
      category: { select: { name: true } },
      optionGroups: {
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: {
          id: true,
          code: true,
          label: true,
          input: true,
          required: true,
          minValue: true,
          maxValue: true,
          sortOrder: true,
          visibleWhen: true,
          options: {
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            select: {
              id: true,
              code: true,
              label: true,
              priceDelta: true,
              pricePctDelta: true,
              sortOrder: true,
              active: true,
            },
          },
        },
      },
    },
  });
  if (!product) return null;

  const groups: OptionGroupView[] = product.optionGroups.map((g) => ({
    id: g.id,
    code: g.code,
    label: g.label,
    input: g.input,
    required: g.required,
    minValue: g.minValue ? Number(g.minValue) : null,
    maxValue: g.maxValue ? Number(g.maxValue) : null,
    sortOrder: g.sortOrder,
    visibleWhen: (g.visibleWhen as { group: string; equals: string } | null) ?? null,
    options: g.options.map((o) => ({
      id: o.id,
      code: o.code,
      label: o.label,
      priceDelta: num(o.priceDelta),
      pricePctDelta: num(o.pricePctDelta),
      sortOrder: o.sortOrder,
      active: o.active,
    })),
  }));

  const facts = {
    status: product.status,
    isConfigurable: product.isConfigurable,
    basePrice: num(product.basePrice),
    inUse: false,
    groups: groups.map((g) => ({
      input: g.input,
      required: g.required,
      optionCount: g.options.length,
      minValue: g.minValue,
      maxValue: g.maxValue,
    })),
  };

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    status: product.status,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    basePrice: facts.basePrice,
    taxRatePct: num(product.taxRatePct),
    leadTimeDays: product.leadTimeDays,
    isConfigurable: product.isConfigurable,
    optionGroupCount: groups.length,
    updatedAt: product.updatedAt,
    groups,
    availableActions: productMachine
      .actionsFrom(product.status)
      .filter((action) => canTransitionProduct(facts, action).ok),
  };
}

function clean(input: ProductInput) {
  return {
    sku: input.sku,
    name: input.name,
    description: input.description || null,
    categoryId: input.categoryId,
    basePrice: input.basePrice,
    taxRatePct: input.taxRatePct,
    leadTimeDays: input.leadTimeDays,
    isConfigurable: input.isConfigurable,
  };
}

export async function createProduct(
  db: CatalogDb,
  actor: CatalogActor,
  input: ProductInput,
): Promise<{ id: string }> {
  const taken = await db.product.findFirst({ where: { sku: input.sku }, select: { id: true } });
  if (taken) throw new PlatformError("invalid_state", `SKU ${input.sku} is already in use.`);
  const category = await db.productCategory.findFirst({
    where: { id: input.categoryId },
    select: { id: true },
  });
  if (!category) throw new PlatformError("not_found", "That category doesn't exist here.");

  const product = await db.product.create({
    data: { ...clean(input), organizationId: actor.organizationId, status: "DRAFT" },
    select: { id: true },
  });
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    changes: { sku: input.sku, name: input.name },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return product;
}

export async function updateProduct(
  db: CatalogDb,
  actor: CatalogActor,
  productId: string,
  input: ProductInput,
): Promise<void> {
  const taken = await db.product.findFirst({
    where: { sku: input.sku, NOT: { id: productId } },
    select: { id: true },
  });
  if (taken) throw new PlatformError("invalid_state", `SKU ${input.sku} is already in use.`);
  const { count } = await db.product.updateMany({
    where: { id: productId },
    data: clean(input),
  });
  if (count === 0) throw new PlatformError("not_found", "Product not found.");
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "product.updated",
    entityType: "product",
    entityId: productId,
    changes: { sku: input.sku, name: input.name },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}

/** Loads the facts the policy needs, including whether anything points at it. */
async function factsFor(db: CatalogDb, productId: string) {
  const product = await db.product.findFirst({
    where: { id: productId },
    select: {
      id: true,
      sku: true,
      status: true,
      isConfigurable: true,
      basePrice: true,
      optionGroups: {
        select: {
          input: true,
          required: true,
          minValue: true,
          maxValue: true,
          _count: { select: { options: true } },
        },
      },
      _count: { select: { quoteLines: true, orderLines: true } },
    },
  });
  if (!product) throw new PlatformError("not_found", "Product not found.");
  return {
    product,
    facts: {
      status: product.status,
      isConfigurable: product.isConfigurable,
      basePrice: num(product.basePrice),
      inUse: product._count.quoteLines + product._count.orderLines > 0,
      groups: product.optionGroups.map((g) => ({
        input: g.input,
        required: g.required,
        optionCount: g._count.options,
        minValue: g.minValue ? Number(g.minValue) : null,
        maxValue: g.maxValue ? Number(g.maxValue) : null,
      })),
    },
  };
}

export async function transitionProduct(
  db: CatalogDb,
  actor: CatalogActor,
  productId: string,
  action: ProductAction,
): Promise<{ status: ProductStatus }> {
  const { product, facts } = await factsFor(db, productId);
  enforce(canTransitionProduct(facts, action));
  const status = productMachine.next(facts.status, action);

  await db.$transaction(async (tx: CatalogTx) => {
    await tx.product.update({ where: { id: productId }, data: { status } });
    await recordAudit(platformTx(tx), {
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      action: `product.${action}`,
      entityType: "product",
      entityId: productId,
      changes: { sku: product.sku, status: { from: facts.status, to: status } },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  });
  return { status };
}

export async function deleteProduct(
  db: CatalogDb,
  actor: CatalogActor,
  productId: string,
): Promise<void> {
  const { product, facts } = await factsFor(db, productId);
  enforce(canDeleteProduct(facts));
  await db.$transaction(async (tx: CatalogTx) => {
    await tx.product.delete({ where: { id: productId } });
    await recordAudit(platformTx(tx), {
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      action: "product.deleted",
      entityType: "product",
      entityId: productId,
      changes: { sku: product.sku },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  });
}
