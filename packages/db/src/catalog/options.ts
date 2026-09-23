import {
  CATALOG_MESSAGES,
  codeFromLabel,
  validateOptionGroup,
} from "@ai-ems/domain/catalog/product-policy";

import { recordAudit } from "../platform/audit";
import {
  platformClient,
  PlatformError,
  type CrmActor as CatalogActor,
  type CrmDb as CatalogDb,
} from "../crm/types";

import type { OptionInput } from "../generated/prisma/client";

export interface OptionGroupInput {
  productId: string;
  code?: string | null;
  label: string;
  input: OptionInput;
  required: boolean;
  minValue?: number | null;
  maxValue?: number | null;
  sortOrder: number;
}

export interface ProductOptionInput {
  groupId: string;
  label: string;
  priceDelta: number;
  pricePctDelta: number;
  sortOrder: number;
}

/** Codes are stable identifiers configurations will refer to; they're unique per product. */
async function uniqueGroupCode(
  db: CatalogDb,
  productId: string,
  label: string,
  ignoreId?: string,
): Promise<string> {
  const base = codeFromLabel(label);
  for (let i = 0; i < 50; i++) {
    const code = i === 0 ? base : `${base.slice(0, 20)}_${i + 1}`;
    const taken = await db.optionGroup.findFirst({
      where: { productId, code, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new PlatformError("invalid_state", "Choose a different label.");
}

async function uniqueOptionCode(
  db: CatalogDb,
  groupId: string,
  label: string,
  ignoreId?: string,
): Promise<string> {
  const base = codeFromLabel(label);
  for (let i = 0; i < 50; i++) {
    const code = i === 0 ? base : `${base.slice(0, 20)}_${i + 1}`;
    const taken = await db.productOption.findFirst({
      where: { groupId, code, ...(ignoreId ? { NOT: { id: ignoreId } } : {}) },
      select: { id: true },
    });
    if (!taken) return code;
  }
  throw new PlatformError("invalid_state", "Choose a different label.");
}

function assertRange(input: OptionGroupInput): void {
  const result = validateOptionGroup({
    input: input.input,
    required: input.required,
    // A brand-new choice list is allowed to be empty until options are added;
    // the publish check is what refuses to sell one.
    optionCount: 1,
    minValue: input.minValue ?? null,
    maxValue: input.maxValue ?? null,
  });
  if (!result.ok) throw new PlatformError("invalid_state", CATALOG_MESSAGES[result.reason]);
}

export async function saveOptionGroup(
  db: CatalogDb,
  actor: CatalogActor,
  input: OptionGroupInput,
  groupId?: string,
): Promise<{ id: string }> {
  assertRange(input);
  const product = await db.product.findFirst({
    where: { id: input.productId },
    select: { id: true },
  });
  if (!product) throw new PlatformError("not_found", "Product not found.");

  const data = {
    label: input.label,
    input: input.input,
    required: input.required,
    minValue: input.minValue ?? null,
    maxValue: input.maxValue ?? null,
    sortOrder: input.sortOrder,
  };

  if (groupId) {
    const { count } = await db.optionGroup.updateMany({
      where: { id: groupId, productId: input.productId },
      data,
    });
    if (count === 0) throw new PlatformError("not_found", "Option group not found.");
    await audit(db, actor, "option_group.updated", groupId, { label: input.label });
    return { id: groupId };
  }

  const group = await db.optionGroup.create({
    data: {
      ...data,
      organizationId: actor.organizationId,
      productId: input.productId,
      code: input.code || (await uniqueGroupCode(db, input.productId, input.label)),
    },
    select: { id: true },
  });
  await audit(db, actor, "option_group.created", group.id, { label: input.label });
  return group;
}

export async function deleteOptionGroup(
  db: CatalogDb,
  actor: CatalogActor,
  groupId: string,
): Promise<void> {
  const { count } = await db.optionGroup.deleteMany({ where: { id: groupId } });
  if (count === 0) throw new PlatformError("not_found", "Option group not found.");
  await audit(db, actor, "option_group.deleted", groupId);
}

export async function saveOption(
  db: CatalogDb,
  actor: CatalogActor,
  input: ProductOptionInput,
  optionId?: string,
): Promise<{ id: string }> {
  const group = await db.optionGroup.findFirst({
    where: { id: input.groupId },
    select: { id: true, input: true },
  });
  if (!group) throw new PlatformError("not_found", "Option group not found.");
  if (group.input === "TEXT" || group.input === "BOOLEAN") {
    throw new PlatformError(
      "invalid_state",
      "Free-text and yes/no groups don't take a list of options.",
    );
  }

  const data = {
    label: input.label,
    priceDelta: input.priceDelta,
    pricePctDelta: input.pricePctDelta,
    sortOrder: input.sortOrder,
  };

  if (optionId) {
    const { count } = await db.productOption.updateMany({
      where: { id: optionId, groupId: input.groupId },
      data,
    });
    if (count === 0) throw new PlatformError("not_found", "Option not found.");
    await audit(db, actor, "product_option.updated", optionId, { label: input.label });
    return { id: optionId };
  }

  const option = await db.productOption.create({
    data: {
      ...data,
      organizationId: actor.organizationId,
      groupId: input.groupId,
      code: await uniqueOptionCode(db, input.groupId, input.label),
    },
    select: { id: true },
  });
  await audit(db, actor, "product_option.created", option.id, { label: input.label });
  return option;
}

export async function deleteOption(
  db: CatalogDb,
  actor: CatalogActor,
  optionId: string,
): Promise<void> {
  const { count } = await db.productOption.deleteMany({ where: { id: optionId } });
  if (count === 0) throw new PlatformError("not_found", "Option not found.");
  await audit(db, actor, "product_option.deleted", optionId);
}

async function audit(
  db: CatalogDb,
  actor: CatalogActor,
  action: string,
  entityId: string,
  changes?: Record<string, string>,
): Promise<void> {
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action,
    entityType: action.startsWith("option_group") ? "option_group" : "product_option",
    entityId,
    ...(changes ? { changes } : {}),
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}
