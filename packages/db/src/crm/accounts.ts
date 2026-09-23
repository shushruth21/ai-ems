import type { AccountType } from "../generated/prisma/client";
import { recordAudit } from "../platform/audit";

import { platformClient, PlatformError, type CrmActor, type CrmDb } from "./types";

export interface AccountInput {
  name: string;
  type: AccountType;
  industry?: string | null;
  website?: string | null;
  taxId?: string | null;
}

export interface AccountRow {
  id: string;
  name: string;
  type: AccountType;
  industry: string | null;
  website: string | null;
  contactCount: number;
  openLeadCount: number;
  createdAt: Date;
}

const OPEN_LEADS = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"] as const;

export async function listAccounts(db: CrmDb, search?: string): Promise<AccountRow[]> {
  const rows = await db.account.findMany({
    where: {
      archivedAt: null,
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: 500,
    select: {
      id: true,
      name: true,
      type: true,
      industry: true,
      website: true,
      createdAt: true,
      _count: { select: { contacts: true } },
      leads: { where: { status: { in: [...OPEN_LEADS] } }, select: { id: true } },
    },
  });
  return rows.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    industry: a.industry,
    website: a.website,
    createdAt: a.createdAt,
    contactCount: a._count.contacts,
    openLeadCount: a.leads.length,
  }));
}

/** Just enough of each account to fill a picker. */
export async function accountOptions(db: CrmDb): Promise<Array<{ id: string; name: string }>> {
  return db.account.findMany({
    where: { archivedAt: null },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true },
  });
}

function clean(input: AccountInput) {
  return {
    name: input.name,
    type: input.type,
    industry: input.industry || null,
    website: input.website || null,
    taxId: input.taxId || null,
  };
}

export async function createAccount(
  db: CrmDb,
  actor: CrmActor,
  input: AccountInput,
): Promise<{ id: string }> {
  const existing = await db.account.findFirst({
    where: { name: input.name, archivedAt: null },
    select: { id: true },
  });
  if (existing) throw new PlatformError("invalid_state", "An account with that name exists.");

  const account = await db.account.create({
    data: { ...clean(input), organizationId: actor.organizationId, ownerId: actor.profileId },
    select: { id: true },
  });
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "account.created",
    entityType: "account",
    entityId: account.id,
    changes: { name: input.name, type: input.type },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return account;
}

export async function updateAccount(
  db: CrmDb,
  actor: CrmActor,
  accountId: string,
  input: AccountInput,
): Promise<void> {
  const before = await db.account.findFirst({
    where: { id: accountId, archivedAt: null },
    select: { name: true, type: true },
  });
  if (!before) throw new PlatformError("not_found", "Account not found.");
  await db.account.update({ where: { id: accountId }, data: clean(input) });
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "account.updated",
    entityType: "account",
    entityId: accountId,
    changes: { name: { from: before.name, to: input.name } },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}

/**
 * Accounts are archived, never deleted: quotes, orders and invoices point at
 * them, and the history has to stay readable.
 */
export async function archiveAccount(db: CrmDb, actor: CrmActor, accountId: string): Promise<void> {
  const open = await db.lead.count({
    where: { accountId, status: { in: [...OPEN_LEADS] } },
  });
  if (open > 0) {
    throw new PlatformError(
      "invalid_state",
      `Close or reassign ${open} open ${open === 1 ? "lead" : "leads"} first.`,
    );
  }
  const { count } = await db.account.updateMany({
    where: { id: accountId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (count === 0) throw new PlatformError("not_found", "Account not found.");
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "account.archived",
    entityType: "account",
    entityId: accountId,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}
