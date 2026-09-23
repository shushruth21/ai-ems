import {
  describeConfiguration,
  priceConfiguration,
  type Configuration,
  type ProductSpec,
  type VisibilityRule,
} from "@ai-ems/domain/catalog/configuration";

import { recordAudit } from "../platform/audit";
import {
  platformClient,
  PlatformError,
  type CrmActor as CatalogActor,
  type CrmDb as CatalogDb,
} from "../crm/types";

export type { CatalogActor };

const num = (value: { toString(): string } | null): string => (value ? value.toString() : "0");

/**
 * The product as the configurator sees it: groups in order, their options and
 * any rule that hides them. Read once and handed to the pure domain functions,
 * so validation and pricing can't drift between the browser and the server.
 */
export async function getProductSpec(
  db: CatalogDb,
  productId: string,
): Promise<(ProductSpec & { id: string; status: string }) | null> {
  const product = await db.product.findFirst({
    where: { id: productId },
    select: {
      id: true,
      sku: true,
      name: true,
      status: true,
      basePrice: true,
      taxRatePct: true,
      optionGroups: {
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
        select: {
          code: true,
          label: true,
          input: true,
          required: true,
          minValue: true,
          maxValue: true,
          visibleWhen: true,
          options: {
            where: { active: true },
            orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
            select: { code: true, label: true, priceDelta: true, pricePctDelta: true },
          },
        },
      },
    },
  });
  if (!product) return null;

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    status: product.status,
    basePrice: num(product.basePrice),
    taxRatePct: num(product.taxRatePct),
    groups: product.optionGroups.map((group) => ({
      code: group.code,
      label: group.label,
      input: group.input,
      required: group.required,
      minValue: group.minValue ? Number(group.minValue) : null,
      maxValue: group.maxValue ? Number(group.maxValue) : null,
      visibleWhen: (group.visibleWhen as VisibilityRule | null) ?? null,
      options: group.options.map((option) => ({
        code: option.code,
        label: option.label,
        priceDelta: num(option.priceDelta),
        pricePctDelta: num(option.pricePctDelta),
      })),
    })),
  };
}

export interface SavedConfigurationRow {
  id: string;
  name: string;
  productId: string;
  productName: string;
  productSku: string;
  leadId: string | null;
  leadTitle: string | null;
  answers: Configuration;
  summary: string[];
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: Date;
}

const select = {
  id: true,
  name: true,
  productId: true,
  leadId: true,
  answers: true,
  quantity: true,
  unitPrice: true,
  total: true,
  createdAt: true,
  product: { select: { name: true, sku: true } },
  lead: { select: { title: true } },
} as const;

async function toRow(
  db: CatalogDb,
  row: {
    id: string;
    name: string;
    productId: string;
    leadId: string | null;
    answers: unknown;
    quantity: { toString(): string };
    unitPrice: { toString(): string };
    total: { toString(): string };
    createdAt: Date;
    product: { name: string; sku: string };
    lead: { title: string } | null;
  },
): Promise<SavedConfigurationRow> {
  const answers = (row.answers ?? {}) as Configuration;
  const spec = await getProductSpec(db, row.productId);
  return {
    id: row.id,
    name: row.name,
    productId: row.productId,
    productName: row.product.name,
    productSku: row.product.sku,
    leadId: row.leadId,
    leadTitle: row.lead?.title ?? null,
    answers,
    summary: spec ? describeConfiguration(spec, answers) : [],
    quantity: Number(row.quantity),
    unitPrice: Number(row.unitPrice),
    total: Number(row.total),
    createdAt: row.createdAt,
  };
}

export async function listConfigurations(
  db: CatalogDb,
  filters: { productId?: string; leadId?: string } = {},
): Promise<SavedConfigurationRow[]> {
  const rows = await db.savedConfiguration.findMany({
    where: {
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(filters.leadId ? { leadId: filters.leadId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select,
  });
  return Promise.all(rows.map((row) => toRow(db, row)));
}

export interface SaveConfigurationInput {
  productId: string;
  leadId?: string | null;
  name: string;
  answers: Configuration;
  quantity: number;
}

/**
 * Prices and stores a configuration. The answers are validated against the
 * product's own groups here, not just in the browser: the price that gets
 * saved is the one the server computed, and an invalid configuration is
 * refused with the same messages the configurator shows.
 */
export async function saveConfiguration(
  db: CatalogDb,
  actor: CatalogActor,
  input: SaveConfigurationInput,
): Promise<{ id: string; unitPrice: string; total: string }> {
  const spec = await getProductSpec(db, input.productId);
  if (!spec) throw new PlatformError("not_found", "Product not found.");
  if (spec.status !== "ACTIVE") {
    throw new PlatformError("invalid_state", "Only a published product can be configured.");
  }

  const priced = priceConfiguration(spec, input.answers, { quantity: String(input.quantity) });
  if (!priced.ok) {
    throw new PlatformError("invalid_state", priced.issues.map((i) => i.message).join(" "));
  }

  if (input.leadId) {
    const lead = await db.lead.findFirst({ where: { id: input.leadId }, select: { id: true } });
    if (!lead) throw new PlatformError("not_found", "That lead doesn't exist here.");
  }

  const saved = await db.savedConfiguration.create({
    data: {
      organizationId: actor.organizationId,
      productId: input.productId,
      leadId: input.leadId || null,
      name: input.name,
      answers: priced.cleaned,
      quantity: input.quantity,
      unitPrice: priced.unitPrice,
      total: priced.total,
      priceBreakdown: {
        unitPrice: priced.unitPrice,
        total: priced.total,
        components: priced.breakdown.components.map((c) => ({
          label: c.label,
          amount: c.amount.toString(),
        })),
      },
      createdById: actor.profileId,
    },
    select: { id: true },
  });

  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "configuration.saved",
    entityType: "saved_configuration",
    entityId: saved.id,
    changes: { product: spec.sku, name: input.name, total: priced.total },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });

  return { id: saved.id, unitPrice: priced.unitPrice, total: priced.total };
}

export async function deleteConfiguration(
  db: CatalogDb,
  actor: CatalogActor,
  configurationId: string,
): Promise<void> {
  const { count } = await db.savedConfiguration.deleteMany({ where: { id: configurationId } });
  if (count === 0) throw new PlatformError("not_found", "Configuration not found.");
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "configuration.deleted",
    entityType: "saved_configuration",
    entityId: configurationId,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}

/** Sum of what a lead's configurations come to — the basis for its value. */
export async function configuredValue(db: CatalogDb, leadId: string): Promise<number> {
  const rows = await db.savedConfiguration.findMany({
    where: { leadId },
    select: { total: true },
  });
  return rows.reduce((sum, row) => sum + Number(row.total), 0);
}
