import { canEditLead } from "@ai-ems/domain/crm/lead-policy";

import type { ActivityType } from "../generated/prisma/client";

import { PlatformError, type CrmActor, type CrmDb, type CrmTx } from "./types";

export interface ActivityInput {
  leadId: string;
  type: ActivityType;
  subject: string;
  body?: string | null;
  outcome?: string | null;
  /** Moves the lead's follow-up date at the same time. */
  nextFollowUpAt?: Date | null;
}

export interface ActivityRow {
  id: string;
  type: ActivityType;
  subject: string;
  body: string | null;
  outcome: string | null;
  occurredAt: Date;
  actorId: string;
  actorName: string | null;
}

export async function listActivities(
  db: CrmDb,
  leadId: string,
  limit = 100,
): Promise<ActivityRow[]> {
  const rows = await db.activity.findMany({
    where: { leadId },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      subject: true,
      body: true,
      outcome: true,
      occurredAt: true,
      actorId: true,
    },
  });
  const ids = [...new Set(rows.map((r) => r.actorId))];
  const profiles = ids.length
    ? await db.profile.findMany({
        where: { id: { in: ids } },
        select: { id: true, fullName: true, email: true },
      })
    : [];
  const names = new Map(profiles.map((p) => [p.id, p.fullName ?? p.email]));
  return rows.map((r) => ({ ...r, actorName: names.get(r.actorId) ?? null }));
}

/**
 * Logs what happened with a lead. Anyone who may edit the lead may add to its
 * timeline; the timeline itself is append-only, which is what makes it
 * trustworthy later.
 */
export async function logActivity(
  db: CrmDb,
  actor: CrmActor,
  input: ActivityInput,
): Promise<{ id: string }> {
  const lead = await db.lead.findFirst({
    where: { id: input.leadId },
    select: {
      status: true,
      ownerId: true,
      accountId: true,
      contactId: true,
      estimatedValue: true,
      firstResponseAt: true,
    },
  });
  if (!lead) throw new PlatformError("not_found", "Lead not found.");
  const allowed = canEditLead(
    {
      status: lead.status,
      ownerId: lead.ownerId,
      hasContact: Boolean(lead.contactId ?? lead.accountId),
      estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
    },
    { profileId: actor.profileId, canAssign: actor.canAssign },
  );
  if (!allowed.ok) {
    throw new PlatformError("forbidden", "This lead belongs to someone else.");
  }

  return db.$transaction(async (tx: CrmTx) => {
    const now = new Date();
    const activity = await tx.activity.create({
      data: {
        organizationId: actor.organizationId,
        leadId: input.leadId,
        type: input.type,
        subject: input.subject,
        body: input.body || null,
        outcome: input.outcome || null,
        occurredAt: now,
        actorId: actor.profileId,
      },
      select: { id: true },
    });
    // The first outbound touch is the response-time metric; it is set once.
    const contacted = input.type !== "NOTE" && !lead.firstResponseAt;
    if (contacted || input.nextFollowUpAt !== undefined) {
      await tx.lead.update({
        where: { id: input.leadId },
        data: {
          ...(contacted ? { firstResponseAt: now } : {}),
          ...(input.nextFollowUpAt !== undefined ? { nextFollowUpAt: input.nextFollowUpAt } : {}),
        },
      });
    }
    return activity;
  });
}
