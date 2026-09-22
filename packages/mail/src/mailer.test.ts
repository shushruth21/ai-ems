import { createMailer } from "./mailer";

const message = { to: "ada@example.test", subject: "Hello", text: "Body with a link" };

describe("mailer", () => {
  it("prints in development and reports delivery", async () => {
    const lines: string[] = [];
    const mailer = createMailer({
      transport: "log",
      from: "AI EMS <no-reply@example.test>",
      log: (l) => lines.push(l),
    });
    expect(await mailer.send(message)).toMatchObject({ delivered: true, transport: "log" });
    expect(lines.join("")).toContain("ada@example.test");
  });

  it("reports that nothing was sent when no transport is configured", async () => {
    const mailer = createMailer({ transport: "none", from: "x@example.test" });
    expect(await mailer.send(message)).toEqual({ delivered: false, transport: "none" });
  });

  it("posts to Resend and surfaces API failures without throwing", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const ok = createMailer({
      transport: "resend",
      from: "x@example.test",
      resendApiKey: "re_test",
      fetchImpl: (async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return new Response(JSON.stringify({ id: "msg_1" }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    expect(await ok.send(message)).toMatchObject({ delivered: true, messageId: "msg_1" });
    expect(calls[0]?.url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({ to: ["ada@example.test"] });

    const failing = createMailer({
      transport: "resend",
      from: "x@example.test",
      resendApiKey: "re_test",
      fetchImpl: (async () => new Response("nope", { status: 422 })) as unknown as typeof fetch,
    });
    expect(await failing.send(message)).toMatchObject({
      delivered: false,
      error: expect.stringContaining("422"),
    });
  });

  it("fails safely when a transport is misconfigured", async () => {
    const mailer = createMailer({ transport: "smtp", from: "x@example.test" });
    expect(await mailer.send(message)).toMatchObject({
      delivered: false,
      error: expect.stringContaining("SMTP_URL"),
    });
  });
});
