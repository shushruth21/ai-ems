"use server";

import { revalidatePath } from "next/cache";

import { LOGIN_PATH, ONBOARDING_PATH, withNext } from "@/lib/routes";
import { appUrl } from "@/server/auth/app-url";
import { limitAuthAttempt } from "@/server/auth/rate-limit";
import { getRequestMeta } from "@/server/auth/request-meta";
import { getSessionUser, requireSession } from "@/server/auth/session";
import { sendMail } from "@/server/mail/mailer";
import { ForbiddenError, requireOrgContext } from "@/server/org/context";
import { rememberOrganization } from "@/server/org/last-org";
import { redirectTo } from "@/server/redirect";
import { authErrorMessage } from "@ai-ems/security/authentication/errors";
import { toFieldErrors, type ActionResult } from "@ai-ems/contracts/auth";
import {
  changeMemberRoleSchema,
  createOrganizationSchema,
  invitationIdSchema,
  invitationTokenSchema,
  inviteMemberSchema,
  membershipIdSchema,
  orgSecuritySchema,
  slugSchema,
  updateOrganizationSchema,
} from "@ai-ems/contracts/organization";
import { prisma } from "@ai-ems/db/client";
import {
  acceptInvitation as acceptInvitationRecord,
  createInvitation,
  reissueInvitation,
  revokeInvitation as revokeInvitationRecord,
  type CreatedInvitation,
} from "@ai-ems/db/platform/invitations";
import {
  changeMemberRole as changeMemberRoleRecord,
  leaveOrganization as leaveOrganizationRecord,
  removeMember as removeMemberRecord,
  setMemberStatus,
} from "@ai-ems/db/platform/members";
import {
  isSlugTaken,
  provisionOrganization,
  setRequireMfa,
  updateOrganization as updateOrganizationRecord,
} from "@ai-ems/db/platform/organizations";
import { PlatformError } from "@ai-ems/db/platform/types";
import { slugCandidates } from "@ai-ems/domain/organization/slug";
import { logger } from "@ai-ems/observability/logger";

/*
 * Organization, member and invitation actions. Each action re-resolves the
 * caller's membership from the slug it is given (never trusts the client),
 * checks permissions, validates with the shared contract, and records an
 * audit event through the repository layer.
 */

type Fail = Extract<ActionResult, { ok: false }>;

function failFrom(error: unknown): Fail {
  if (error instanceof PlatformError) {
    return error.code === "slug_taken"
      ? { ok: false, fieldErrors: { slug: error.message } }
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

// ─── Workspaces ───────────────────────────────────────────────────────────

export async function checkSlugAvailability(
  slug: string,
): Promise<{ available: boolean; message?: string; suggestion?: string }> {
  await requireSession();
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { available: false, message: parsed.error.issues[0]?.message };
  if (!(await isSlugTaken(prisma, parsed.data))) return { available: true };
  for (const candidate of slugCandidates(parsed.data)) {
    if (!(await isSlugTaken(prisma, candidate))) {
      return { available: false, message: "That address is taken.", suggestion: candidate };
    }
  }
  return { available: false, message: "That address is taken." };
}

export async function createOrganization(input: unknown): Promise<ActionResult> {
  const user = await requireSession({ next: ONBOARDING_PATH });
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const limit = await limitAuthAttempt("org-create", user.id);
  if (!limit.allowed) return { ok: false, formError: authErrorMessage("rate_limited").message };

  const meta = await getRequestMeta();
  let slug: string;
  try {
    const org = await provisionOrganization(prisma, {
      ...parsed.data,
      owner: { id: user.id, email: user.email, fullName: user.fullName },
      ...meta,
    });
    slug = org.slug;
  } catch (error) {
    return failFrom(error);
  }
  await rememberOrganization(slug);
  redirectTo(`/${slug}/dashboard?welcome=1`);
}

export async function updateOrganization(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.settings.manage");
    const parsed = updateOrganizationSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await updateOrganizationRecord(
      prisma,
      ctx.organization.id,
      ctx.user.id,
      {
        ...parsed.data,
        legalName: parsed.data.legalName || null,
        taxId: parsed.data.taxId || null,
      },
      await getRequestMeta(),
    );
    revalidatePath(`/${slug}`, "layout");
    return { ok: true, message: "Settings saved." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function updateSecurityPolicy(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.settings.manage");
    const parsed = orgSecuritySchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    // Turning the policy on from a session without MFA would lock the admin out.
    if (parsed.data.requireMfa && ctx.user.aal !== "aal2") {
      return {
        ok: false,
        formError:
          "Set up two-factor authentication on your own account first (Account & security).",
      };
    }
    await setRequireMfa(
      prisma,
      ctx.organization.id,
      ctx.user.id,
      parsed.data.requireMfa,
      await getRequestMeta(),
    );
    revalidatePath(`/${slug}`, "layout");
    return {
      ok: true,
      message: parsed.data.requireMfa
        ? "Two-factor authentication is now required for everyone."
        : "Two-factor authentication is now optional.",
    };
  } catch (error) {
    return failFrom(error);
  }
}

// ─── Invitations ──────────────────────────────────────────────────────────

export interface InvitationLink {
  email: string;
  roleName: string;
  link: string;
  expiresAt: string;
  emailed: boolean;
}

async function deliverInvitation(
  inv: CreatedInvitation,
  organizationName: string,
  inviterName: string,
): Promise<InvitationLink> {
  const link = appUrl(`/invite/${inv.token}`);
  const { delivered } = await sendMail({
    to: inv.email,
    subject: `${inviterName} invited you to ${organizationName} on AI EMS`,
    text: [
      `${inviterName} invited you to join ${organizationName} as ${inv.roleName}.`,
      "",
      `Accept the invitation: ${link}`,
      "",
      `The link works once and expires on ${inv.expiresAt.toUTCString()}.`,
      "If you weren't expecting this, you can ignore this email.",
    ].join("\n"),
  });
  return {
    email: inv.email,
    roleName: inv.roleName,
    link,
    expiresAt: inv.expiresAt.toISOString(),
    emailed: delivered,
  };
}

export async function inviteMember(
  slug: string,
  input: unknown,
): Promise<ActionResult<InvitationLink>> {
  try {
    const ctx = await requireOrgContext(slug, "platform.members.manage");
    const parsed = inviteMemberSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const limit = await limitAuthAttempt("invite", ctx.user.id);
    if (!limit.allowed) return { ok: false, formError: authErrorMessage("rate_limited").message };

    const inv = await createInvitation(
      prisma,
      {
        organizationId: ctx.organization.id,
        actorProfileId: ctx.user.id,
        actorRoleKey: ctx.role.key,
        ...(await getRequestMeta()),
      },
      parsed.data.email,
      parsed.data.roleKey,
    );
    const data = await deliverInvitation(
      inv,
      ctx.organization.name,
      ctx.user.fullName ?? ctx.user.email,
    );
    revalidatePath(`/${slug}/settings/members`);
    return { ok: true, data };
  } catch (error) {
    return failFrom(error);
  }
}

export async function resendInvitation(
  slug: string,
  input: unknown,
): Promise<ActionResult<InvitationLink>> {
  try {
    const ctx = await requireOrgContext(slug, "platform.members.manage");
    const parsed = invitationIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const inv = await reissueInvitation(
      prisma,
      {
        organizationId: ctx.organization.id,
        actorProfileId: ctx.user.id,
        actorRoleKey: ctx.role.key,
        ...(await getRequestMeta()),
      },
      parsed.data.invitationId,
    );
    const data = await deliverInvitation(
      inv,
      ctx.organization.name,
      ctx.user.fullName ?? ctx.user.email,
    );
    revalidatePath(`/${slug}/settings/members`);
    return { ok: true, data };
  } catch (error) {
    return failFrom(error);
  }
}

export async function revokeInvitation(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.members.manage");
    const parsed = invitationIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await revokeInvitationRecord(
      prisma,
      {
        organizationId: ctx.organization.id,
        actorProfileId: ctx.user.id,
        actorRoleKey: ctx.role.key,
        ...(await getRequestMeta()),
      },
      parsed.data.invitationId,
    );
    revalidatePath(`/${slug}/settings/members`);
    return { ok: true, message: "Invitation revoked." };
  } catch (error) {
    return failFrom(error);
  }
}

/** Accepting is bound to the signed-in email; anonymous visitors are sent to sign in first. */
export async function acceptInvitation(token: string): Promise<ActionResult> {
  const next = `/invite/${token}`;
  const user = await getSessionUser();
  if (!user) redirectTo(withNext(LOGIN_PATH, next));
  if (!invitationTokenSchema.safeParse(token).success) {
    return { ok: false, formError: "This invitation link is invalid." };
  }
  const limit = await limitAuthAttempt("invite-accept", user.id);
  if (!limit.allowed) return { ok: false, formError: authErrorMessage("rate_limited").message };

  let slug: string;
  try {
    ({ slug } = await acceptInvitationRecord(
      prisma,
      token,
      { id: user.id, email: user.email, fullName: user.fullName },
      await getRequestMeta(),
    ));
  } catch (error) {
    if (error instanceof PlatformError) return { ok: false, formError: error.message };
    logger.error("invitation.accept_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
  await rememberOrganization(slug);
  redirectTo(`/${slug}/dashboard?joined=1`);
}

// ─── Members ──────────────────────────────────────────────────────────────

export async function changeMemberRole(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.members.manage");
    const parsed = changeMemberRoleSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await changeMemberRoleRecord(
      prisma,
      {
        organizationId: ctx.organization.id,
        actorMembershipId: ctx.membership.id,
        ...(await getRequestMeta()),
      },
      parsed.data.membershipId,
      parsed.data.roleKey,
    );
    revalidatePath(`/${slug}/settings/members`);
    return { ok: true, message: "Role updated." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function suspendMember(slug: string, input: unknown): Promise<ActionResult> {
  return memberStatus(slug, input, "SUSPENDED");
}

export async function reactivateMember(slug: string, input: unknown): Promise<ActionResult> {
  return memberStatus(slug, input, "ACTIVE");
}

async function memberStatus(
  slug: string,
  input: unknown,
  status: "ACTIVE" | "SUSPENDED",
): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.members.manage");
    const parsed = membershipIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await setMemberStatus(
      prisma,
      {
        organizationId: ctx.organization.id,
        actorMembershipId: ctx.membership.id,
        ...(await getRequestMeta()),
      },
      parsed.data.membershipId,
      status,
    );
    revalidatePath(`/${slug}/settings/members`);
    return {
      ok: true,
      message: status === "SUSPENDED" ? "Member suspended." : "Member reactivated.",
    };
  } catch (error) {
    return failFrom(error);
  }
}

export async function removeMember(slug: string, input: unknown): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug, "platform.members.manage");
    const parsed = membershipIdSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    await removeMemberRecord(
      prisma,
      {
        organizationId: ctx.organization.id,
        actorMembershipId: ctx.membership.id,
        ...(await getRequestMeta()),
      },
      parsed.data.membershipId,
    );
    revalidatePath(`/${slug}/settings/members`);
    return { ok: true, message: "Member removed." };
  } catch (error) {
    return failFrom(error);
  }
}

export async function leaveOrganization(slug: string): Promise<ActionResult> {
  try {
    const ctx = await requireOrgContext(slug);
    await leaveOrganizationRecord(prisma, {
      organizationId: ctx.organization.id,
      actorMembershipId: ctx.membership.id,
      ...(await getRequestMeta()),
    });
  } catch (error) {
    return failFrom(error);
  }
  redirectTo("/account?notice=left-organization");
}
