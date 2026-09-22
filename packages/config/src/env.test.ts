import { authSettings, mailSettings, mailTransport, parsePublicEnv, parseServerEnv } from "./env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://ref.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
};

describe("env", () => {
  it("accepts a valid configuration and applies defaults", () => {
    const e = parseServerEnv(valid);
    expect(e.NEXT_PUBLIC_APP_NAME).toBe("AI EMS");
    expect(e.AI_PROVIDER).toBe("none");
  });

  it("reports every invalid variable", () => {
    expect(() =>
      parseServerEnv({ ...valid, DATABASE_URL: "mysql://x", SUPABASE_SECRET_KEY: "" }),
    ).toThrow(/DATABASE_URL[\s\S]*SUPABASE_SECRET_KEY|SUPABASE_SECRET_KEY[\s\S]*DATABASE_URL/);
  });

  it("validates public variables separately", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow(
      /Invalid public/,
    );
  });

  it("derives auth settings per environment", () => {
    expect(authSettings(parseServerEnv(valid))).toEqual({
      rateLimitEnabled: true,
      rateLimitStore: "memory",
      identitySecret: "sb_secret_x",
    });
    const prod = authSettings(
      parseServerEnv({ ...valid, NODE_ENV: "production", AUTH_IDENTITY_SECRET: "x".repeat(32) }),
    );
    expect(prod.rateLimitStore).toBe("postgres");
    expect(prod.identitySecret).toBe("x".repeat(32));
    expect(
      authSettings(
        parseServerEnv({ ...valid, NODE_ENV: "production", AUTH_RATE_LIMIT_STORE: "memory" }),
      ).rateLimitStore,
    ).toBe("memory");
  });

  it("never logs emails in production by default", () => {
    expect(mailTransport(parseServerEnv(valid))).toBe("log");
    expect(mailTransport(parseServerEnv({ ...valid, NODE_ENV: "production" }))).toBe("none");
  });

  it("collects mail settings and worker tuning", () => {
    const e = parseServerEnv({
      ...valid,
      MAIL_TRANSPORT: "smtp",
      SMTP_URL: "smtp://user:pass@mail.example:587",
      MAIL_FROM: "AI EMS <no-reply@example.test>",
      WORKER_POLL_MS: "500",
    });
    expect(mailSettings(e)).toEqual({
      transport: "smtp",
      from: "AI EMS <no-reply@example.test>",
      smtpUrl: "smtp://user:pass@mail.example:587",
    });
    expect(e.WORKER_POLL_MS).toBe(500);
    expect(e.WORKER_BATCH_SIZE).toBe(20);
    expect(() => parseServerEnv({ ...valid, SMTP_URL: "http://x" })).toThrow(/SMTP_URL/);
  });
});
