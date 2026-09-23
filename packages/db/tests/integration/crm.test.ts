import { randomBytes, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { ALL_PERMISSIONS, moduleOf, PERMISSIONS } from "@ai-ems/security/authorization/permissions";

import { archiveAccount, createAccount, listAccounts, updateAccount } from "../../src/crm/accounts";
import { listActivities, logActivity } from "../../src/crm/activities";
import { createContact, listContacts } from "../../src/crm/contacts";
import {
  assignLead,
  createLead,
  getLead,
  leadPipeline,
  listLeads,
  overdueFollowUps,
  transitionLead,
  updateLead,
} from "../../src/crm/leads";
import { PrismaClient } from "../../src/generated/prisma/client";
import { provisionOrganization } from "../../src/platform/organizations";
import { scopeToTenant } from "../../src/tenant-client";

/**
 * CRM repositories against the real migrations. The interesting parts are the
 * ones that only exist in the database: gap-free numbering under concurrency,
 * the tenant extension, and the transactions behind each lifecycle step.
 */
const adminUrl = process.env.TEST_DATABASE_URL;
const migrationsDir = fileURLToPath(new URL("../../prisma/migrations", import.meta.url));

describe.skipIf(!adminUrl)("CRM repositories (real schema)", () => {
  const dbName = `aiems_crm_${randomBytes(4).toString("hex")}`;
  let admin: pg.Client;
  let root: PrismaClient;
  let orgA: string;
  let orgB: string;
  let repId: string;
  let managerId: string;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`create database ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    const setup = new pg.Client({ connectionString: url.toString() });
    await setup.connect();
    for (const dir of readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()) {
      await setup.query(readFileSync(`${migrationsDir}/${dir}/migration.sql`, "utf8"));
    }
    for (const key of ALL_PERMISSIONS) {
      await setup.query("insert into permissions (key, module, description) values ($1, $2, $3)", [
        key,
        moduleOf(key),
        PERMISSIONS[key],
      ]);
    }
    await setup.end();
    root = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });

    repId = randomUUID();
    managerId = randomUUID();
    const a = await provisionOrganization(root, {
      name: "Acme Furniture",
      slug: `crm-a-${randomBytes(3).toString("hex")}`,
      currency: "USD",
      timezone: "UTC",
      owner: { id: managerId, email: `manager.${randomBytes(3).toString("hex")}@example.test` },
    });
    const b = await provisionOrganization(root, {
      name: "Other Co",
      slug: `crm-b-${randomBytes(3).toString("hex")}`,
      currency: "USD",
      timezone: "UTC",
      owner: { id: randomUUID(), email: `other.${randomBytes(3).toString("hex")}@example.test` },
    });
    orgA = a.id;
    orgB = b.id;

    // A second member of org A who may only work on their own leads.
    await root.profile.create({
      data: { id: repId, email: `rep.${randomBytes(3).toString("hex")}@example.test` },
    });
    const salesRep = await root.role.findFirstOrThrow({
      where: { organizationId: orgA, key: "sales_rep" },
    });
    await root.membership.create({
      data: { organizationId: orgA, profileId: repId, roleId: salesRep.id, status: "ACTIVE" },
    });
  });

  afterAll(async () => {
    await root?.$disconnect();
    await admin?.query(`drop database if exists ${dbName} with (force)`);
    await admin?.end();
  });

  const manager = () => ({ organizationId: orgA, profileId: managerId, canAssign: true });
  const rep = () => ({ organizationId: orgA, profileId: repId, canAssign: false });
  const dbA = () => scopeToTenant(root, orgA);
  const dbB = () => scopeToTenant(root, orgB);

  it("numbers leads gap-free, even when two are created at once", async () => {
    const [one, two] = await Promise.all([
      createLead(dbA(), manager(), { title: "Showroom sofa", source: "WALK_IN" }),
      createLead(dbA(), manager(), { title: "Office chairs", source: "WEBSITE" }),
    ]);
    const numbers = [one.number, two.number].sort();
    expect(numbers[0]).toMatch(/^LD-\d{4}-00001$/);
    expect(numbers[1]).toMatch(/^LD-\d{4}-00002$/);

    // Numbering is per workspace: the other one starts at 1 again.
    const elsewhere = await createLead(
      dbB(),
      { organizationId: orgB, profileId: managerId, canAssign: true },
      { title: "Their lead", source: "OTHER" },
    );
    expect(elsewhere.number).toMatch(/-00001$/);
  });

  it("keeps one workspace's CRM invisible to another", async () => {
    expect((await listLeads(dbB())).map((l) => l.title)).toEqual(["Their lead"]);
    const mine = (await listLeads(dbA()))[0]!;
    expect(
      await getLead(
        dbB(),
        { organizationId: orgB, profileId: managerId, canAssign: true },
        mine.id,
      ),
    ).toBeNull();
  });

  it("walks a lead through its lifecycle and records every step", async () => {
    const account = await createAccount(dbA(), manager(), {
      name: "Harbor Hotels",
      type: "PROSPECT",
    });
    const contact = await createContact(dbA(), manager(), {
      firstName: "Nia",
      lastName: "Patel",
      email: "NIA@harbor.test",
      marketingOptIn: false,
    });
    expect((await listContacts(dbA()))[0]?.email).toBe("nia@harbor.test");

    const lead = await createLead(dbA(), manager(), {
      title: "Lobby refurbishment",
      source: "REFERRAL",
      accountId: account.id,
      contactId: contact.id,
      estimatedValue: 24000,
    });

    // Qualification needs a contact; a proposal needs a value — both are there.
    await transitionLead(dbA(), manager(), lead.id, "contact");
    await transitionLead(dbA(), manager(), lead.id, "qualify");
    await transitionLead(dbA(), manager(), lead.id, "propose");
    const detail = (await getLead(dbA(), manager(), lead.id))!;
    expect(detail.status).toBe("PROPOSAL");
    expect(detail.availableActions.sort()).toEqual(["disqualify", "lose", "win"]);
    expect(detail.accountName).toBe("Harbor Hotels");
    expect(detail.contactName).toBe("Nia Patel");

    // Closing as lost needs a reason, and is written to the timeline.
    await expect(transitionLead(dbA(), manager(), lead.id, "lose")).rejects.toMatchObject({
      code: "invalid_state",
    });
    await transitionLead(dbA(), manager(), lead.id, "lose", "Went with another supplier");
    const closed = (await getLead(dbA(), manager(), lead.id))!;
    expect(closed.status).toBe("LOST");
    expect(closed.lostReason).toBe("Went with another supplier");
    expect(closed.nextFollowUpAt).toBeNull();

    const timeline = await listActivities(dbA(), lead.id);
    expect(timeline.map((a) => a.subject)).toEqual([
      "Lead lose",
      "Lead propose",
      "Lead qualify",
      "Lead contact",
    ]);

    // Lost leads can be picked up again; won ones are final.
    await transitionLead(dbA(), manager(), lead.id, "reopen");
    await transitionLead(dbA(), manager(), lead.id, "qualify");
    await transitionLead(dbA(), manager(), lead.id, "win");
    expect((await getLead(dbA(), manager(), lead.id))!.availableActions).toEqual([]);
  });

  it("stops a rep from touching someone else's lead, and lets a manager reassign", async () => {
    const lead = await createLead(dbA(), manager(), {
      title: "Manager's lead",
      source: "PHONE",
      estimatedValue: 1000,
    });
    await expect(
      updateLead(dbA(), rep(), lead.id, { title: "Mine now", source: "PHONE" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      logActivity(dbA(), rep(), { leadId: lead.id, type: "CALL", subject: "Called them" }),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(assignLead(dbA(), rep(), lead.id, repId)).rejects.toMatchObject({
      code: "forbidden",
    });

    await assignLead(dbA(), manager(), lead.id, repId);
    expect((await getLead(dbA(), rep(), lead.id))!.ownerId).toBe(repId);
    await logActivity(dbA(), rep(), {
      leadId: lead.id,
      type: "CALL",
      subject: "Introduced ourselves",
      nextFollowUpAt: new Date("2026-01-05T00:00:00Z"),
    });
    const updated = (await getLead(dbA(), rep(), lead.id))!;
    expect(updated.nextFollowUpAt).toEqual(new Date("2026-01-05T00:00:00Z"));

    // Assigning notifies the new owner through the outbox.
    const events = await root.outboxEvent.findMany({
      where: { organizationId: orgA, type: "lead.assigned" },
    });
    expect(events).toHaveLength(1);

    // An unknown person can't be given a lead.
    await expect(assignLead(dbA(), manager(), lead.id, randomUUID())).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("summarises the pipeline and surfaces overdue follow-ups", async () => {
    const pipeline = await leadPipeline(dbA());
    expect(pipeline.map((b) => b.status)).toEqual(["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL"]);
    expect(pipeline.reduce((sum, b) => sum + b.count, 0)).toBeGreaterThan(0);

    const overdue = await overdueFollowUps(dbA(), { now: new Date("2026-06-01T00:00:00Z") });
    expect(overdue.map((l) => l.title)).toContain("Manager's lead");
    expect(await overdueFollowUps(dbA(), { now: new Date("2025-01-01T00:00:00Z") })).toEqual([]);
  });

  it("archives accounts only once their open leads are dealt with", async () => {
    const account = await createAccount(dbA(), manager(), { name: "Closing Co", type: "CUSTOMER" });
    const lead = await createLead(dbA(), manager(), {
      title: "Open work",
      source: "EMAIL",
      accountId: account.id,
    });
    await expect(archiveAccount(dbA(), manager(), account.id)).rejects.toMatchObject({
      code: "invalid_state",
    });
    await transitionLead(dbA(), manager(), lead.id, "disqualify", "Out of scope");
    await archiveAccount(dbA(), manager(), account.id);
    expect((await listAccounts(dbA())).map((a) => a.name)).not.toContain("Closing Co");

    await expect(
      updateAccount(dbA(), manager(), account.id, { name: "Closing Co", type: "CUSTOMER" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
