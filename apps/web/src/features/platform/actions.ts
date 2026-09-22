"use server";

import { revalidatePath } from "next/cache";

import { getRequestMeta } from "@/server/auth/request-meta";
import { ForbiddenError, requireOrgContext } from "@/server/org/context";
import { toFieldErrors, type ActionResult } from "@ai-ems/contracts/auth";
import {
  apiKeyIdSchema,
  createApiKeySchema,
  createRoleSchema,
  notificationIdSchema,
  roleIdSchema,
  updateRoleSchema,
} from "@ai-ems/contracts/platform";
import { prisma } from "@ai-ems/db/client";
import { createApiKey, revokeApiKey } from "@ai-ems/db/platform/api-keys";
import { markAllNotificationsRead, markNotificationRead } from "@ai-ems/db/platform/notifications";
import { createRole, deleteRole, updateRole } from "@ai-ems/db/platform/roles";
import { PlatformError } from "@ai-ems/db/platform/types";
import type { Permission } from "@ai-ems/security/authorization/permissions";

/*
 * Roles, notifications and API keys. Every action re-resolves the caller's
 * membership from the slug, so a client can never act on a workspace it isn't
 * a member of, and role edits are capped by the caller's own permissions.
 */

type Fail = Extract<ActionResult, { ok: false }>;

function failFrom(error: unknown): Fail {
  if (error instanceof PlatformError) return { ok: false, formError: error.message };
  if (error instanceof ForbiddenError) {
    return { ok: false, formError: "You don't have permission to do that." };
  }
  throw error;
}

const invalid = (error: Parameters<typeof toFieldErrors>[0]): Fail => ({
  ok: false,
  fieldErrors: toFieldErrors(error),
});

// ─── Roles ────────────────────────────────────────────────────────────────

export async function createCustomRole(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.roles.manage");
    const parsed = createRoleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await createRole(prisma, await roleActor(ctx), {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      permissions: parsed.data.permissions as Permission[],
    });
    revalidatePath(`/${slug}/settings/roles`);
    return { ok: true, message: `Role "${parsed.data.name}" created.` };
  } catch (error) {
    return failFrom(error);
  }
}

export async function updateCustomRole(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.roles.manage");
    const parsed = updateRoleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await updateRole(prisma, await roleActor(ctx), parsed.data.roleId, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      permissions: parsed.data.permissions as Permission[],
    });
    revalidatePath(`/${slug}`, "layout");
    return { ok: true, message: "Role updated." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function deleteCustomRole(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.roles.manage");
    const parsed = roleIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await deleteRole(prisma, await roleActor(ctx), parsed.data.roleId);
    revalidatePath(`/${slug}/settings/roles`);
    return { ok: true, message: "Role deleted." };
  } catch (error) {
    return failFrom(error);
  }
}

type Ctx = Awaited<ReturnType<typeof requireOrgContext>>;

async function roleActor(ctx: Ctx) {
  return {
    organizationId: ctx.organization.id,
    actorProfileId: ctx.user.id,
    actorPermissions: ctx.permissions,
    ...(await getRequestMeta()),
  };
}

// ─── Notifications ────────────────────────────────────────────────────────

export async function markRead(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug);
    const parsed = notificationIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await markNotificationRead(
      prisma,
      ctx.organization.id,
      ctx.user.id,
      parsed.data.notificationId,
    );
    revalidatePath(`/${slug}`, "layout");
    return { ok: true };
  } catch (error) {
    return failFrom(error);
  }
}

export async function markAllRead(slug: string): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug);
    const count = await markAllNotificationsRead(prisma, ctx.organization.id, ctx.user.id);
    revalidatePath(`/${slug}`, "layout");
    return { ok: true, message: count ? `${count} marked as read.` : "Nothing unread." };
  } catch (error) {
    return failFrom(error);
  }
}

// ─── API keys ─────────────────────────────────────────────────────────────

export interface NewApiKey {
  name: string;
  token: string;
  expiresAt: string | null;
}

export async function createKey(slug: string, input: unknown): Promise<ActionResult<NewApiKey>> {
  try {
    const ctx = await requireOrgContext(slug, "platform.settings.manage");
    const parsed = createApiKeySchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const key = await createApiKey(
      prisma,
      {
        organizationId: ctx.organization.id,
        actorProfileId: ctx.user.id,
        ...(await getRequestMeta()),
      },
      {
        name: parsed.data.name,
        scopes: [...parsed.data.scopes],
        ...(parsed.data.expiresInDays ? { expiresInDays: parsed.data.expiresInDays } : {}),
      },
    );
    revalidatePath(`/${slug}/settings/api-keys`);
    // The token is returned once and never stored in readable form.
    return {
      ok: true,
      data: {
        name: parsed.data.name,
        token: key.token,
        expiresAt: key.expiresAt?.toISOString() ?? null,
      },
    };
  } catch (error) {
    return failFrom(error);
  }
}

export async function revokeKey(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.settings.manage");
    const parsed = apiKeyIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await revokeApiKey(
      prisma,
      {
        organizationId: ctx.organization.id,
        actorProfileId: ctx.user.id,
        ...(await getRequestMeta()),
      },
      parsed.data.apiKeyId,
    );
    revalidatePath(`/${slug}/settings/api-keys`);
    return { ok: true, message: "Key revoked." };
  } catch (error) {
    return failFrom(error);
  }
}
