import { describe, expect, it, vi } from "vitest";

import type { Mailer } from "@ai-ems/mail/mailer";
import type { Db } from "@ai-ems/db/platform/types";

import { runBatch, type RunnerOptions } from "./runner";

interface Row {
  id: string;
  organizationId: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  availableAt: Date;
  lastError?: string | null;
}

/**
 * A hand-rolled stand-in for the Prisma client: enough of the surface the
 * outbox repositories touch to exercise claim → handle → complete/fail.
 * The repositories themselves run against real PostgreSQL in the db package's
 * integration suite.
 */
function fakeDb(rows: Row[], options: { failWrites?: boolean } = {}) {
  const notifications: Array<Record<string, unknown>> = [];
  const members = [
    { profileId: "manager-1", profile: { email: "manager@example.test" } },
    { profileId: "joiner", profile: { email: "joiner@example.test" } },
  ];
  const db = {
    rows,
    notifications,
    async $queryRaw() {
      const claimed = rows.filter((r) => r.status === "PENDING" && r.availableAt <= new Date());
      for (const r of claimed) {
        r.status = "PROCESSING";
        r.attempts += 1;
      }
      return claimed.map((r) => ({
        id: BigInt(r.id),
        organization_id: r.organizationId,
        type: r.type,
        payload: r.payload,
        attempts: r.attempts,
      }));
    },
    outboxEvent: {
      async update({ where, data }: { where: { id: bigint }; data: Partial<Row> }) {
        const row = rows.find((r) => r.id === where.id.toString());
        Object.assign(row!, data);
        return row;
      },
      async updateMany() {
        return { count: 0 };
      },
    },
    notification: {
      async createMany({ data }: { data: Array<Record<string, unknown>> }) {
        if (options.failWrites) throw new Error("database is down");
        notifications.push(...data);
        return { count: data.length };
      },
    },
    organization: {
      async findUniqueOrThrow() {
        return { name: "Northwind", slug: "northwind" };
      },
    },
    profile: {
      async findUnique() {
        return { email: "joiner@example.test", fullName: "Jo Joiner" };
      },
    },
    membership: {
      async findMany() {
        return members;
      },
    },
  };
  return db as unknown as Db & typeof db;
}

function options(db: Db, mailer: Mailer): RunnerOptions {
  return { db, mailer, appUrl: "https://app.test/", batchSize: 20 };
}

const mailer = (): Mailer & { sent: Array<{ to: string; subject: string }> } => {
  const sent: Array<{ to: string; subject: string }> = [];
  return {
    transport: "log",
    sent,
    send: vi.fn(async (message: { to: string; subject: string }) => {
      sent.push(message);
      return { delivered: true as const, transport: "log" as const };
    }),
  } as unknown as Mailer & { sent: Array<{ to: string; subject: string }> };
};

const row = (over: Partial<Row> = {}): Row => ({
  id: "1",
  organizationId: "org-1",
  type: "member.joined",
  payload: { profileId: "joiner", roleName: "Sales Representative", membershipId: "m-1" },
  attempts: 0,
  status: "PENDING",
  availableAt: new Date(Date.now() - 1000),
  ...over,
});

describe("runBatch", () => {
  it("turns an event into notifications and email, then marks it done", async () => {
    const db = fakeDb([row()]);
    const mail = mailer();
    const result = await runBatch(options(db, mail));

    expect(result).toMatchObject({ claimed: 1, done: 1, notifications: 1 });
    // The person who joined is not notified about themselves.
    expect(db.notifications).toHaveLength(1);
    expect(db.notifications[0]).toMatchObject({
      recipientId: "manager-1",
      organizationId: "org-1",
      type: "member.joined",
      href: "/northwind/settings/members",
    });
    expect(db.notifications[0]!.title).toContain("Jo Joiner");
    expect(mail.sent).toMatchObject([
      { to: "manager@example.test", subject: expect.stringContaining("joined Northwind") },
    ]);
    expect(db.rows[0]!.status).toBe("DONE");
  });

  it("links use the configured app URL exactly once", async () => {
    const db = fakeDb([row()]);
    const mail = mailer();
    await runBatch(options(db, mail));
    const text = (mail.send as unknown as { mock: { calls: Array<[{ text: string }]> } }).mock
      .calls[0]![0].text;
    expect(text).toContain("https://app.test/northwind/settings/members");
  });

  it("drains events it has no handler for instead of blocking the queue", async () => {
    const db = fakeDb([row({ type: "invoice.overdue" })]);
    const result = await runBatch(options(db, mailer()));
    expect(result).toMatchObject({ claimed: 1, skipped: 1, done: 0 });
    expect(db.rows[0]!.status).toBe("DONE");
    expect(db.notifications).toHaveLength(0);
  });

  it("retries a failing event with backoff and parks it after the last attempt", async () => {
    const failing = fakeDb([row()], { failWrites: true });
    const result = await runBatch(options(failing, mailer()));
    expect(result).toMatchObject({ claimed: 1, retried: 1, dead: 0 });
    expect(failing.rows[0]!.status).toBe("PENDING");
    expect(failing.rows[0]!.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(failing.rows[0]!.lastError).toContain("database is down");

    const exhausted = fakeDb([row({ attempts: 7 })], { failWrites: true });
    const last = await runBatch(options(exhausted, mailer()));
    expect(last).toMatchObject({ dead: 1, retried: 0 });
    expect(exhausted.rows[0]!.status).toBe("FAILED");
  });

  it("does nothing when the queue is empty", async () => {
    const db = fakeDb([]);
    const mail = mailer();
    expect(await runBatch(options(db, mail))).toMatchObject({ claimed: 0, done: 0 });
    expect(mail.sent).toEqual([]);
  });
});
