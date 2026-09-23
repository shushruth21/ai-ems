"use server";

import { revalidatePath } from "next/cache";

import { getRequestMeta } from "@/server/auth/request-meta";
import { ForbiddenError, hasPermission, requireOrgContext } from "@/server/org/context";
import { redirectTo } from "@/server/redirect";
import { toFieldErrors, type ActionResult } from "@ai-ems/contracts/auth";
import {
  accountIdSchema,
  accountSchema,
  assignLeadSchema,
  contactIdSchema,
  contactSchema,
  createLeadSchema,
  logActivitySchema,
  toAmount,
  toDate,
  transitionLeadSchema,
  updateLeadSchema,
} from "@ai-ems/contracts/crm";
import { archiveAccount, createAccount, updateAccount } from "@ai-ems/db/crm/accounts";
import { logActivity } from "@ai-ems/db/crm/activities";
import { archiveContact, createContact, updateContact } from "@ai-ems/db/crm/contacts";
import { assignLead, createLead, transitionLead, updateLead } from "@ai-ems/db/crm/leads";
import type { CrmActor } from "@ai-ems/db/crm/types";
import { PlatformError } from "@ai-ems/db/platform/types";

/**
 * Anything in the CRM can change what the dashboard, the lists and a lead's
 * own page show, so a change revalidates the whole workspace subtree rather
 * than guessing which pages were affected.
 */
function revalidateWorkspace(slug: string): void {
  revalidatePath(`/${slug}`, "layout");
}

/*
 * CRM actions. Each one re-resolves the caller's membership from the slug and
 * works through the tenant-scoped client on the context, so a lead id from
 * another workspace simply isn't found. Ownership rules live in the domain
 * layer and are applied by the repositories.
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

type Ctx = Awaited<ReturnType<typeof requireOrgContext>>;

async function actorFrom(ctx: Ctx): Promise<CrmActor> {
  return {
    organizationId: ctx.organization.id,
    profileId: ctx.user.id,
    canAssign: hasPermission(ctx, "crm.lead.assign"),
    ...(await getRequestMeta()),
  };
}

// ─── Leads ────────────────────────────────────────────────────────────────

export async function newLead(slug: string, input: unknown): Promise<ActionResult> {
  let leadId: string;
  try {
    const ctx = await requireOrgContext(slug, "crm.lead.write");
    const parsed = createLeadSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const lead = await createLead(ctx.db, await actorFrom(ctx), {
      ...parsed.data,
      estimatedValue: toAmount(parsed.data.estimatedValue),
      nextFollowUpAt: toDate(parsed.data.nextFollowUpAt),
    });
    leadId = lead.id;
  } catch (error) {
    return failFrom(error);
  }
  revalidateWorkspace(slug);
  redirectTo(`/${slug}/crm/leads/${leadId}?created=1`);
}

export async function editLead(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.lead.write");
    const parsed = updateLeadSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { leadId, ...rest } = parsed.data;
    await updateLead(ctx.db, await actorFrom(ctx), leadId, {
      ...rest,
      estimatedValue: toAmount(rest.estimatedValue),
      nextFollowUpAt: toDate(rest.nextFollowUpAt),
    });
    revalidateWorkspace(slug);
    return { ok: true, message: "Lead saved." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function moveLead(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.lead.write");
    const parsed = transitionLeadSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { status } = await transitionLead(
      ctx.db,
      await actorFrom(ctx),
      parsed.data.leadId,
      parsed.data.action,
      parsed.data.reason,
    );
    revalidateWorkspace(slug);
    return { ok: true, message: `Lead is now ${status.toLowerCase()}.` };
  } catch (error) {
    return failFrom(error);
  }
}

export async function reassignLead(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.lead.assign");
    const parsed = assignLeadSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await assignLead(ctx.db, await actorFrom(ctx), parsed.data.leadId, parsed.data.ownerId || null);
    revalidateWorkspace(slug);
    return { ok: true, message: "Lead reassigned." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function addActivity(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.lead.write");
    const parsed = logActivitySchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await logActivity(ctx.db, await actorFrom(ctx), {
      ...parsed.data,
      // `undefined` leaves the follow-up date alone; a cleared field clears it.
      nextFollowUpAt:
        parsed.data.nextFollowUpAt === undefined ? undefined : toDate(parsed.data.nextFollowUpAt),
    });
    revalidateWorkspace(slug);
    return { ok: true, message: "Activity logged." };
  } catch (error) {
    return failFrom(error);
  }
}

// ─── Accounts ─────────────────────────────────────────────────────────────

export async function newAccount(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.account.write");
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await createAccount(ctx.db, await actorFrom(ctx), parsed.data);
    revalidateWorkspace(slug);
    return { ok: true, message: `${parsed.data.name} added.` };
  } catch (error) {
    return failFrom(error);
  }
}

export async function editAccount(
  slug: string,
  accountId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.account.write");
    const parsed = accountSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await updateAccount(ctx.db, await actorFrom(ctx), accountId, parsed.data);
    revalidateWorkspace(slug);
    return { ok: true, message: "Account saved." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function removeAccount(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.account.write");
    const parsed = accountIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await archiveAccount(ctx.db, await actorFrom(ctx), parsed.data.accountId);
    revalidateWorkspace(slug);
    return { ok: true, message: "Account archived." };
  } catch (error) {
    return failFrom(error);
  }
}

// ─── Contacts ─────────────────────────────────────────────────────────────

export async function newContact(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.account.write");
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await createContact(ctx.db, await actorFrom(ctx), parsed.data);
    revalidateWorkspace(slug);
    return { ok: true, message: `${parsed.data.firstName} added.` };
  } catch (error) {
    return failFrom(error);
  }
}

export async function editContact(
  slug: string,
  contactId: string,
  input: unknown,
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.account.write");
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await updateContact(ctx.db, await actorFrom(ctx), contactId, parsed.data);
    revalidateWorkspace(slug);
    return { ok: true, message: "Contact saved." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function removeContact(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "crm.account.write");
    const parsed = contactIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await archiveContact(ctx.db, await actorFrom(ctx), parsed.data.contactId);
    revalidateWorkspace(slug);
    return { ok: true, message: "Contact archived." };
  } catch (error) {
    return failFrom(error);
  }
}
