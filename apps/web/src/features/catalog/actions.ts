"use server";

import { revalidatePath } from "next/cache";

import { getRequestMeta } from "@/server/auth/request-meta";
import { ForbiddenError, requireOrgContext } from "@/server/org/context";
import { redirectTo } from "@/server/redirect";
import { toFieldErrors, type ActionResult } from "@ai-ems/contracts/auth";
import {
  categoryIdSchema,
  categorySchema,
  configurationIdSchema,
  configurationSchema,
  groupIdSchema,
  optionGroupSchema,
  optionIdSchema,
  optionSchema,
  productActionSchema,
  productIdSchema,
  productSchema,
  toMoney,
  toOptionalNumber,
} from "@ai-ems/contracts/catalog";
import { archiveCategory, createCategory, updateCategory } from "@ai-ems/db/catalog/categories";
import { deleteConfiguration, saveConfiguration } from "@ai-ems/db/catalog/configurator";
import {
  deleteOption,
  deleteOptionGroup,
  saveOption,
  saveOptionGroup,
} from "@ai-ems/db/catalog/options";
import {
  createProduct,
  deleteProduct,
  transitionProduct,
  updateProduct,
} from "@ai-ems/db/catalog/products";
import type { CrmActor } from "@ai-ems/db/crm/types";
import { PlatformError } from "@ai-ems/db/platform/types";

/*
 * Catalog actions. The catalog is workspace-wide rather than owned by a
 * person, so the only gate is `catalog.product.write`; the rules that matter
 * (SKU uniqueness, publish readiness, option ranges) live in the domain and
 * repository layers.
 */

type Fail = Extract<ActionResult, { ok: false }>;

function failFrom(error: unknown): Fail {
  if (error instanceof PlatformError) {
    return error.message.includes("SKU")
      ? { ok: false, fieldErrors: { sku: error.message } }
      : { ok: false, formError: error.message };
  }
  if (error instanceof ForbiddenError) {
    return { ok: false, formError: "You don't have permission to do that." };
  }
  throw error;
}

const invalid = (error: Parameters<typeof toFieldErrors>[0]): Fail => ({
  ok: false,
  fieldErrors: toFieldErrors(error),
});

type Ctx = Awaited<ReturnType<typeof requireOrgContext>>;

async function actorFrom(ctx: Ctx): Promise<CrmActor> {
  return {
    organizationId: ctx.organization.id,
    profileId: ctx.user.id,
    canAssign: true,
    ...(await getRequestMeta()),
  };
}

/** The catalog shows up in several places; refresh the whole workspace. */
function revalidateWorkspace(slug: string): void {
  revalidatePath(`/${slug}`, "layout");
}

// ─── Products ─────────────────────────────────────────────────────────────

export async function newProduct(slug: string, input: unknown): Promise<ActionResult> {
  let productId: string;
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const product = await createProduct(ctx.db, await actorFrom(ctx), {
      ...parsed.data,
      basePrice: toMoney(parsed.data.basePrice),
      taxRatePct: toMoney(parsed.data.taxRatePct),
    });
    productId = product.id;
  } catch (error) {
    return failFrom(error);
  }
  revalidateWorkspace(slug);
  redirectTo(`/${slug}/catalog/products/${productId}?created=1`);
}

export async function editProduct(
  slug: string,
  productId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = productSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await updateProduct(ctx.db, await actorFrom(ctx), productId, {
      ...parsed.data,
      basePrice: toMoney(parsed.data.basePrice),
      taxRatePct: toMoney(parsed.data.taxRatePct),
    });
    revalidateWorkspace(slug);
    return { ok: true, message: "Product saved." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function moveProduct(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = productActionSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { status } = await transitionProduct(
      ctx.db,
      await actorFrom(ctx),
      parsed.data.productId,
      parsed.data.action,
    );
    revalidateWorkspace(slug);
    return { ok: true, message: `Product is now ${status.toLowerCase()}.` };
  } catch (error) {
    return failFrom(error);
  }
}

export async function removeProduct(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = productIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await deleteProduct(ctx.db, await actorFrom(ctx), parsed.data.productId);
  } catch (error) {
    return failFrom(error);
  }
  revalidateWorkspace(slug);
  redirectTo(`/${slug}/catalog/products?deleted=1`);
}

// ─── Option groups and options ────────────────────────────────────────────

export async function saveGroup(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = optionGroupSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { groupId, visibleWhenGroup, visibleWhenOption, ...rest } = parsed.data;
    await saveOptionGroup(
      ctx.db,
      await actorFrom(ctx),
      {
        ...rest,
        minValue: toOptionalNumber(rest.minValue),
        maxValue: toOptionalNumber(rest.maxValue),
        visibleWhen:
          visibleWhenGroup && visibleWhenOption
            ? { group: visibleWhenGroup, equals: visibleWhenOption }
            : null,
      },
      groupId || undefined,
    );
    revalidateWorkspace(slug);
    return { ok: true, message: groupId ? "Option group saved." : `${rest.label} added.` };
  } catch (error) {
    return failFrom(error);
  }
}

export async function removeGroup(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = groupIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await deleteOptionGroup(ctx.db, await actorFrom(ctx), parsed.data.groupId);
    revalidateWorkspace(slug);
    return { ok: true, message: "Option group removed." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function saveChoice(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = optionSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { optionId, ...rest } = parsed.data;
    await saveOption(
      ctx.db,
      await actorFrom(ctx),
      {
        ...rest,
        priceDelta: toMoney(rest.priceDelta),
        pricePctDelta: toMoney(rest.pricePctDelta),
      },
      optionId || undefined,
    );
    revalidateWorkspace(slug);
    return { ok: true, message: optionId ? "Option saved." : `${rest.label} added.` };
  } catch (error) {
    return failFrom(error);
  }
}

export async function removeChoice(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = optionIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await deleteOption(ctx.db, await actorFrom(ctx), parsed.data.optionId);
    revalidateWorkspace(slug);
    return { ok: true, message: "Option removed." };
  } catch (error) {
    return failFrom(error);
  }
}

// ─── Categories ───────────────────────────────────────────────────────────

export async function newCategory(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await createCategory(ctx.db, await actorFrom(ctx), parsed.data);
    revalidateWorkspace(slug);
    return { ok: true, message: `${parsed.data.name} added.` };
  } catch (error) {
    return failFrom(error);
  }
}

export async function editCategory(
  slug: string,
  categoryId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = categorySchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await updateCategory(ctx.db, await actorFrom(ctx), categoryId, parsed.data);
    revalidateWorkspace(slug);
    return { ok: true, message: "Category saved." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function removeCategory(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "catalog.product.write");
    const parsed = categoryIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await archiveCategory(ctx.db, await actorFrom(ctx), parsed.data.categoryId);
    revalidateWorkspace(slug);
    return { ok: true, message: "Category removed." };
  } catch (error) {
    return failFrom(error);
  }
}

// ─── Saved configurations ─────────────────────────────────────────────────

/**
 * Saves a configured product. The answers arrive as JSON because their shape
 * depends on the product; the repository validates and prices them against
 * the product's own option groups before anything is stored.
 */
export async function saveConfiguredProduct(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "sales.quote.write");
    const parsed = configurationSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);

    let answers: unknown;
    try {
      answers = JSON.parse(parsed.data.answers);
    } catch {
      return { ok: false, formError: "Those answers didn't come through — try again." };
    }
    if (typeof answers !== "object" || answers === null || Array.isArray(answers)) {
      return { ok: false, formError: "Those answers didn't come through — try again." };
    }

    const saved = await saveConfiguration(ctx.db, await actorFrom(ctx), {
      productId: parsed.data.productId,
      leadId: parsed.data.leadId || null,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      answers: answers as Record<string, never>,
    });
    revalidateWorkspace(slug);
    return { ok: true, message: `Saved "${parsed.data.name}" at ${saved.total}.` };
  } catch (error) {
    return failFrom(error);
  }
}

export async function removeConfiguration(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "sales.quote.write");
    const parsed = configurationIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await deleteConfiguration(ctx.db, await actorFrom(ctx), parsed.data.configurationId);
    revalidateWorkspace(slug);
    return { ok: true, message: "Configuration removed." };
  } catch (error) {
    return failFrom(error);
  }
}
