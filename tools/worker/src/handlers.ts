import type { Mailer } from "@ai-ems/mail/mailer";

export interface NotificationDraft {
  recipientId: string;
  type: string;
  title: string;
  body?: string;
  href?: string;
  entityType?: string;
  entityId?: string;
  /** Also email the recipient (when a transport is configured). */
  email?: { to: string; subject: string; text: string };
}

export interface HandlerContext {
  organizationId: string;
  payload: Record<string, unknown>;
  /** Members of the workspace who should hear about this, by permission. */
  recipientsWithPermission(
    permissionKey: string,
  ): Promise<Array<{ profileId: string; email: string }>>;
  profile(profileId: string): Promise<{ email: string; fullName: string | null } | null>;
  organization(): Promise<{ name: string; slug: string }>;
  appUrl(path: string): string;
  mailer: Mailer;
}

export type Handler = (ctx: HandlerContext) => Promise<NotificationDraft[]>;

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

/**
 * Event handlers. Each returns the notifications to create; the runner writes
 * them and sends any attached emails. Payloads never carry secrets — one-time
 * links are sent from the request that created them.
 */
export const handlers: Record<string, Handler> = {
  /** A member accepted an invitation: tell the people who manage members. */
  "member.joined": async (ctx) => {
    const memberId = str(ctx.payload.profileId);
    const roleName = str(ctx.payload.roleName) ?? "a member";
    if (!memberId) return [];
    const [member, org, managers] = await Promise.all([
      ctx.profile(memberId),
      ctx.organization(),
      ctx.recipientsWithPermission("platform.members.manage"),
    ]);
    const who = member?.fullName ?? member?.email ?? "Someone";
    const href = `/${org.slug}/settings/members`;
    return managers
      .filter((m) => m.profileId !== memberId)
      .map((m) => ({
        recipientId: m.profileId,
        type: "member.joined",
        title: `${who} joined ${org.name}`,
        body: `They accepted an invitation as ${roleName}.`,
        href,
        entityType: "membership",
        entityId: str(ctx.payload.membershipId) ?? memberId,
        email: {
          to: m.email,
          subject: `${who} joined ${org.name}`,
          text: `${who} accepted their invitation and joined ${org.name} as ${roleName}.\n\n${ctx.appUrl(href)}`,
        },
      }));
  },

  /** Someone's role changed: tell the person it happened to. */
  "member.role_changed": async (ctx) => {
    const profileId = str(ctx.payload.profileId);
    const roleName = str(ctx.payload.roleName);
    if (!profileId || !roleName) return [];
    const [member, org] = await Promise.all([ctx.profile(profileId), ctx.organization()]);
    if (!member) return [];
    const href = `/${org.slug}/dashboard`;
    return [
      {
        recipientId: profileId,
        type: "member.role_changed",
        title: `Your role in ${org.name} is now ${roleName}`,
        body: "Your access changed accordingly.",
        href,
        entityType: "membership",
        entityId: str(ctx.payload.membershipId) ?? profileId,
        email: {
          to: member.email,
          subject: `Your role in ${org.name} changed`,
          text: `You are now ${roleName} in ${org.name}.\n\n${ctx.appUrl(href)}`,
        },
      },
    ];
  },

  /** Security-relevant workspace changes go to everyone who manages settings. */
  "security.changed": async (ctx) => {
    const summary = str(ctx.payload.summary) ?? "A security setting changed";
    const actorId = str(ctx.payload.actorId);
    const [org, admins] = await Promise.all([
      ctx.organization(),
      ctx.recipientsWithPermission("platform.settings.manage"),
    ]);
    const href = `/${org.slug}/settings`;
    return admins
      .filter((a) => a.profileId !== actorId)
      .map((a) => ({
        recipientId: a.profileId,
        type: "security.changed",
        title: `${org.name}: ${summary}`,
        href,
        entityType: str(ctx.payload.entityType) ?? "organization",
        entityId: str(ctx.payload.entityId) ?? org.slug,
        email: {
          to: a.email,
          subject: `Security setting changed in ${org.name}`,
          text: `${summary}\n\n${ctx.appUrl(href)}`,
        },
      }));
  },
};

export function isKnownEvent(type: string): boolean {
  return type in handlers;
}
