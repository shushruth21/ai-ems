import { parsePublicEnv, parseServerEnv } from "./env";

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
});
