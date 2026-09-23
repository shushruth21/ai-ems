import { recordAudit } from "../platform/audit";

import { platformClient, PlatformError, type CrmActor, type CrmDb } from "./types";

export interface ContactInput {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  accountId?: string | null;
  marketingOptIn: boolean;
}

export interface ContactRow {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  accountId: string | null;
  accountName: string | null;
  marketingOptIn: boolean;
  createdAt: Date;
}

const select = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  jobTitle: true,
  accountId: true,
  marketingOptIn: true,
  createdAt: true,
  account: { select: { name: true } },
} as const;

type Selected = {
  account: { name: string } | null;
} & Omit<ContactRow, "accountName">;

const toRow = (c: Selected): ContactRow => ({
  id: c.id,
  firstName: c.firstName,
  lastName: c.lastName,
  email: c.email,
  phone: c.phone,
  jobTitle: c.jobTitle,
  accountId: c.accountId,
  accountName: c.account?.name ?? null,
  marketingOptIn: c.marketingOptIn,
  createdAt: c.createdAt,
});

export async function listContacts(
  db: CrmDb,
  options: { accountId?: string; search?: string } = {},
): Promise<ContactRow[]> {
  const rows = await db.contact.findMany({
    where: {
      archivedAt: null,
      ...(options.accountId ? { accountId: options.accountId } : {}),
      ...(options.search
        ? {
            OR: [
              { firstName: { contains: options.search, mode: "insensitive" as const } },
              { lastName: { contains: options.search, mode: "insensitive" as const } },
              { email: { contains: options.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
    select,
  });
  return rows.map(toRow);
}

export async function contactOptions(
  db: CrmDb,
): Promise<Array<{ id: string; name: string; accountId: string | null }>> {
  const rows = await db.contact.findMany({
    where: { archivedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 500,
    select: { id: true, firstName: true, lastName: true, accountId: true },
  });
  return rows.map((c) => ({
    id: c.id,
    name: [c.firstName, c.lastName].filter(Boolean).join(" "),
    accountId: c.accountId,
  }));
}

function clean(input: ContactInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName || null,
    email: input.email ? input.email.toLowerCase() : null,
    phone: input.phone || null,
    jobTitle: input.jobTitle || null,
    accountId: input.accountId || null,
    marketingOptIn: input.marketingOptIn,
  };
}

/** The account must be one of this workspace's — the tenant client enforces it. */
async function assertAccount(db: CrmDb, accountId: string | null | undefined): Promise<void> {
  if (!accountId) return;
  const account = await db.account.findFirst({
    where: { id: accountId, archivedAt: null },
    select: { id: true },
  });
  if (!account) throw new PlatformError("not_found", "That account doesn't exist here.");
}

export async function createContact(
  db: CrmDb,
  actor: CrmActor,
  input: ContactInput,
): Promise<{ id: string }> {
  await assertAccount(db, input.accountId);
  const contact = await db.contact.create({
    data: { ...clean(input), organizationId: actor.organizationId },
    select: { id: true },
  });
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "contact.created",
    entityType: "contact",
    entityId: contact.id,
    changes: { name: [input.firstName, input.lastName].filter(Boolean).join(" ") },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
  return contact;
}

export async function updateContact(
  db: CrmDb,
  actor: CrmActor,
  contactId: string,
  input: ContactInput,
): Promise<void> {
  await assertAccount(db, input.accountId);
  const { count } = await db.contact.updateMany({
    where: { id: contactId, archivedAt: null },
    data: clean(input),
  });
  if (count === 0) throw new PlatformError("not_found", "Contact not found.");
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "contact.updated",
    entityType: "contact",
    entityId: contactId,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}

/** Archived, not deleted: leads and activities keep pointing at the person. */
export async function archiveContact(db: CrmDb, actor: CrmActor, contactId: string): Promise<void> {
  const { count } = await db.contact.updateMany({
    where: { id: contactId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (count === 0) throw new PlatformError("not_found", "Contact not found.");
  await recordAudit(platformClient(db), {
    organizationId: actor.organizationId,
    actorId: actor.profileId,
    action: "contact.archived",
    entityType: "contact",
    entityId: contactId,
    ip: actor.ip,
    userAgent: actor.userAgent,
  });
}
