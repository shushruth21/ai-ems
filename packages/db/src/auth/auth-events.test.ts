import { listRecentAuthEvents, recordAuthEvent, type AuthEventDb } from "./auth-events";

function fakeDb() {
  const created: unknown[] = [];
  const findArgs: unknown[] = [];
  const db: AuthEventDb = {
    authEvent: {
      create: (args) => {
        created.push(args.data);
        return Promise.resolve({});
      },
      findMany: (args) => {
        findArgs.push(args);
        return Promise.resolve([
          {
            id: 7n,
            type: "SIGN_IN_SUCCEEDED",
            ip: "1.1.1.1",
            userAgent: "UA",
            createdAt: new Date(0),
          },
        ]);
      },
    },
  };
  return { db, created, findArgs };
}

describe("auth events", () => {
  it("records with defaults and truncates the user agent", async () => {
    const { db, created } = fakeDb();
    await recordAuthEvent(db, {
      type: "SIGN_IN_FAILED",
      identityHash: "h",
      userAgent: "x".repeat(600),
    });
    expect(created[0]).toEqual({
      type: "SIGN_IN_FAILED",
      profileId: null,
      identityHash: "h",
      ip: null,
      userAgent: "x".repeat(512),
    });
  });

  it("lists a bounded number of the user's events with string ids", async () => {
    const { db, findArgs } = fakeDb();
    const rows = await listRecentAuthEvents(db, "p1", 1000);
    expect(rows[0]?.id).toBe("7");
    expect(findArgs[0]).toMatchObject({ where: { profileId: "p1" }, take: 100 });
  });
});
