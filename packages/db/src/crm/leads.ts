import {
  canAssignLead,
  canEditLead,
  canTransition,
  LEAD_MESSAGES,
  leadMachine,
  type LeadAction,
  type LeadResult,
  type LeadStatus,
} from "@ai-ems/domain/crm/lead-policy";

import type { LeadSource, Prisma } from "../generated/prisma/client";
import { recordAudit } from "../platform/audit";
import { enqueueOutbox } from "../platform/outbox";
import { nextDocumentNumber } from "../platform/sequences";

import {
  platformClient,
  platformTx,
  PlatformError,
  type CrmActor,
  type CrmDb,
  type CrmTx,
} from "./types";

export interface LeadInput {
  title: string;
  source: LeadSource;
  campaign?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  estimatedValue?: number | null;
  nextFollowUpAt?: Date | null;
}

export interface LeadRow {
  id: string;
  number: string;
  title: string;
  status: LeadStatus;
  source: LeadSource;
  accountId: string | null;
  accountName: string | null;
  contactId: string | null;
  contactName: string | null;
  ownerId: string | null;
  ownerName: string | null;
  estimatedValue: number | null;
  nextFollowUpAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadDetail extends LeadRow {
  campaign: string | null;
  lostReason: string | null;
  convertedAt: Date | null;
  /** Lifecycle steps this person may take right now. */
  availableActions: LeadAction[];
}

export interface LeadFilters {
  status?: LeadStatus | "OPEN";
  ownerId?: string;
  search?: string;
}

const OPEN: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"];

const select = {
  id: true,
  number: true,
  title: true,
  status: true,
  source: true,
  campaign: true,
  accountId: true,
  contactId: true,
  ownerId: true,
  estimatedValue: true,
  nextFollowUpAt: true,
  lostReason: true,
  convertedAt: true,
  createdAt: true,
  updatedAt: true,
  account: { select: { name: true } },
  contact: { select: { firstName: true, lastName: true } },
} as const;

type SelectedLead = Prisma.LeadGetPayload<{ select: typeof select }>;

function toRow(lead: SelectedLead, ownerNames: Map<string, string>): LeadRow {
  return {
    id: lead.id,
    number: lead.number,
    title: lead.title,
    status: lead.status,
    source: lead.source,
    accountId: lead.accountId,
    accountName: lead.account?.name ?? null,
    contactId: lead.contactId,
    contactName: lead.contact
      ? [lead.contact.firstName, lead.contact.lastName].filter(Boolean).join(" ")
      : null,
    ownerId: lead.ownerId,
    ownerName: lead.ownerId ? (ownerNames.get(lead.ownerId) ?? null) : null,
    estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
    nextFollowUpAt: lead.nextFollowUpAt,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}

/** Owner ids are auth user ids; their names live on the profiles table. */
async function ownerNames(db: CrmDb, ids: Array<string | null>): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const profiles = await db.profile.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true, email: true },
  });
  return new Map(profiles.map((p) => [p.id, p.fullName ?? p.email]));
}

export async function listLeads(db: CrmDb, filters: LeadFilters = {}): Promise<LeadRow[]> {
  const rows = await db.lead.findMany({
    where: {
      ...(filters.status === "OPEN"
        ? { status: { in: OPEN } }
        : filters.status
          ? { status: filters.status }
          : {}),
      ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: "insensitive" as const } },
              { number: { contains: filters.search, mode: "insensitive" as const } },
              { account: { name: { contains: filters.search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: 500,
    select,
  });
  const names = await ownerNames(
    db,
    rows.map((r) => r.ownerId),
  );
  return rows.map((row) => toRow(row, names));
}

export async function getLead(
  db: CrmDb,
  actor: CrmActor,
  leadId: string,
): Promise<LeadDetail | null> {
  const lead = await db.lead.findFirst({ where: { id: leadId }, select });
  if (!lead) return null;
  const names = await ownerNames(db, [lead.ownerId]);
  const row = toRow(lead, names);
  const facts = {
    status: lead.status,
    ownerId: lead.ownerId,
    hasContact: Boolean(lead.contactId ?? lead.accountId),
    estimatedValue: row.estimatedValue,
  };
  const actorFacts = { profileId: actor.profileId, canAssign: actor.canAssign };
  return {
    ...row,
    campaign: lead.campaign,
    lostReason: lead.lostReason,
    convertedAt: lead.convertedAt,
    availableActions: leadMachine
      .actionsFrom(lead.status)
      .filter((action) => canTransition(facts, actorFacts, action, { reason: "provided" }).ok),
  };
}

function enforce(result: LeadResult): void {
  if (result.ok) return;
  throw new PlatformError(
    result.reason === "not_owner" ? "forbidden" : "invalid_state",
    LEAD_MESSAGES[result.reason],
  );
}

function cleanInput(input: LeadInput) {
  return {
    title: input.title,
    source: input.source,
    campaign: input.campaign || null,
    accountId: input.accountId || null,
    contactId: input.contactId || null,
    estimatedValue: input.estimatedValue ?? null,
    nextFollowUpAt: input.nextFollowUpAt ?? null,
  };
}

/**
 * Creates a lead with a gap-free number. The sequence row is locked inside the
 * same transaction as the insert, so a rollback gives the number back.
 */
export async function createLead(
  db: CrmDb,
  actor: CrmActor,
  input: LeadInput,
): Promise<{ id: string; number: string }> {
  return db.$transaction(async (tx: CrmTx) => {
    const number = await nextDocumentNumber(platformTx(tx), actor.organizationId, "lead");
    const lead = await tx.lead.create({
      data: {
        ...cleanInput(input),
        organizationId: actor.organizationId,
        number,
        status: "NEW",
        ownerId: actor.profileId,
      },
      select: { id: true },
    });
    await recordAudit(platformTx(tx), {
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      action: "lead.created",
      entityType: "lead",
      entityId: lead.id,
      changes: { number, title: input.title, source: input.source },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return { id: lead.id, number };
  });
}

/** Loads the facts the policy needs, or throws if the lead isn't here. */
async function factsFor(db: CrmDb, leadId: string) {
  const lead = await db.lead.findFirst({
    where: { id: leadId },
    select: {
      id: true,
      number: true,
      status: true,
      ownerId: true,
      accountId: true,
      contactId: true,
      estimatedValue: true,
    },
  });
  if (!lead) throw new PlatformError("not_found", "Lead not found.");
  return {
    lead,
    facts: {
      status: lead.status,
      ownerId: lead.ownerId,
      hasContact: Boolean(lead.contactId ?? lead.accountId),
      estimatedValue: lead.estimatedValue ? Number(lead.estimatedValue) : null,
    },
  };
}

export async function updateLead(
  db: CrmDb,
  actor: CrmActor,
  leadId: string,
  input: LeadInput,
): Promise<void> {
  const { facts } = await factsFor(db, leadId);
  enforce(canEditLead(facts, { profileId: actor.profileId, canAssign: actor.canAssign }));
  await db.lead.update({ where: { id: leadId }, data: cleanInput(input) });
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "lead.updated",
    entityType: "lead",
    entityId: leadId,
    changes: { title: input.title },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}

/**
 * Moves a lead along its lifecycle. The status change, the audit row, the
 * activity note and the notification event are one transaction.
 */
export async function transitionLead(
  db: CrmDb,
  actor: CrmActor,
  leadId: string,
  action: LeadAction,
  reason?: string | null,
): Promise<{ status: LeadStatus }> {
  const { lead, facts } = await factsFor(db, leadId);
  enforce(
    canTransition(facts, { profileId: actor.profileId, canAssign: actor.canAssign }, action, {
      reason,
    }),
  );
  const status = leadMachine.next(facts.status, action);

  await db.$transaction(async (tx: CrmTx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        status,
        lostReason: action === "lose" || action === "disqualify" ? (reason ?? null) : null,
        convertedAt: status === "WON" ? new Date() : null,
        ...(status === "WON" || status === "LOST" || status === "DISQUALIFIED"
          ? { nextFollowUpAt: null }
          : {}),
      },
    });
    await tx.activity.create({
      data: {
        organizationId: actor.organizationId,
        leadId,
        type: "NOTE",
        subject: `Lead ${action}`,
        body: reason || null,
        outcome: status,
        actorId: actor.profileId,
      },
    });
    await recordAudit(platformTx(tx), {
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      action: `lead.${action}`,
      entityType: "lead",
      entityId: leadId,
      changes: { status: { from: facts.status, to: status }, reason: reason || null },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    if (status === "WON" || status === "LOST") {
      await enqueueOutbox(platformTx(tx), [
        {
          organizationId: actor.organizationId,
          type: "lead.closed",
          payload: {
            leadId,
            number: lead.number,
            status,
            ownerId: lead.ownerId,
            actorId: actor.profileId,
          },
        },
      ]);
    }
  });
  return { status };
}

/** Reassignment: a permission, and the new owner hears about it. */
export async function assignLead(
  db: CrmDb,
  actor: CrmActor,
  leadId: string,
  ownerId: string | null,
): Promise<void> {
  enforce(canAssignLead({ profileId: actor.profileId, canAssign: actor.canAssign }));
  const { lead } = await factsFor(db, leadId);
  if (ownerId) {
    const member = await db.membership.findFirst({
      where: { organizationId: actor.organizationId, profileId: ownerId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!member) throw new PlatformError("not_found", "That person isn't an active member here.");
  }
  if (lead.ownerId === ownerId) return;

  await db.$transaction(async (tx: CrmTx) => {
    await tx.lead.update({ where: { id: leadId }, data: { ownerId } });
    await recordAudit(platformTx(tx), {
      organizationId: actor.organizationId,
      actorId: actor.profileId,
      action: "lead.assigned",
      entityType: "lead",
      entityId: leadId,
      changes: { owner: { from: lead.ownerId, to: ownerId } },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    if (ownerId && ownerId !== actor.profileId) {
      await enqueueOutbox(platformTx(tx), [
        {
          organizationId: actor.organizationId,
          type: "lead.assigned",
          payload: { leadId, number: lead.number, ownerId, actorId: actor.profileId },
        },
      ]);
    }
  });
}

export interface PipelineBucket {
  status: LeadStatus;
  count: number;
  value: number;
}

/** Pipeline by status — the dashboard's headline numbers. */
export async function leadPipeline(db: CrmDb, ownerId?: string): Promise<PipelineBucket[]> {
  const rows = await db.lead.groupBy({
    by: ["status"],
    where: { status: { in: OPEN }, ...(ownerId ? { ownerId } : {}) },
    _count: { _all: true },
    _sum: { estimatedValue: true },
  });
  const byStatus = new Map(rows.map((r) => [r.status, r]));
  return OPEN.map((status) => ({
    status,
    count: byStatus.get(status)?._count._all ?? 0,
    value: Number(byStatus.get(status)?._sum.estimatedValue ?? 0),
  }));
}

/** Open leads whose follow-up date has passed, oldest first. */
export async function overdueFollowUps(
  db: CrmDb,
  options: { ownerId?: string; now?: Date; limit?: number } = {},
): Promise<LeadRow[]> {
  const rows = await db.lead.findMany({
    where: {
      status: { in: OPEN },
      nextFollowUpAt: { lt: options.now ?? new Date() },
      ...(options.ownerId ? { ownerId: options.ownerId } : {}),
    },
    orderBy: { nextFollowUpAt: "asc" },
    take: options.limit ?? 20,
    select,
  });
  const names = await ownerNames(
    db,
    rows.map((r) => r.ownerId),
  );
  return rows.map((row) => toRow(row, names));
}
