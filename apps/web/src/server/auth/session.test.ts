import type { User } from "@supabase/supabase-js";

import { parseClientIp } from "./request-meta";
import { toSessionUser } from "./session";

function user(over: Partial<User> = {}): User {
  return {
    id: "u1",
    aud: "authenticated",
    email: "ada@example.com",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Ada Lovelace" },
    created_at: "2026-01-01T00:00:00Z",
    factors: [],
    ...over,
  } as User;
}

const factor = (id: string, status: "verified" | "unverified") => ({
  id,
  status,
  friendly_name: "",
  factor_type: "totp" as const,
  created_at: "2026-01-02T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
});

describe("toSessionUser", () => {
  it("maps a plain password user", () => {
    expect(toSessionUser(user(), "aal1")).toMatchObject({
      id: "u1",
      fullName: "Ada Lovelace",
      mfaRequired: false,
      verifiedFactors: [],
      providers: ["email"],
    });
  });

  it("requires MFA only for aal1 sessions with a verified factor", () => {
    const u = user({ factors: [factor("f1", "verified"), factor("f2", "unverified")] });
    const aal1 = toSessionUser(u, "aal1");
    expect(aal1.mfaRequired).toBe(true);
    expect(aal1.verifiedFactors).toEqual([
      { id: "f1", name: "Authenticator app", createdAt: "2026-01-02T00:00:00Z" },
    ]);
    expect(aal1.pendingFactorIds).toEqual(["f2"]);
    expect(toSessionUser(u, "aal2").mfaRequired).toBe(false);
    expect(toSessionUser(user({ factors: [factor("f2", "unverified")] }), "aal1").mfaRequired).toBe(
      false,
    );
  });

  it("ignores blank or non-string names", () => {
    expect(toSessionUser(user({ user_metadata: { full_name: "  " } }), "aal1").fullName).toBeNull();
    expect(toSessionUser(user({ user_metadata: { full_name: 42 } }), "aal1").fullName).toBeNull();
  });
});

describe("parseClientIp", () => {
  it("takes the first hop and rejects junk", () => {
    expect(parseClientIp("203.0.113.9, 10.0.0.1")).toBe("203.0.113.9");
    expect(parseClientIp("2001:db8::1")).toBe("2001:db8::1");
    expect(parseClientIp("<script>")).toBeNull();
    expect(parseClientIp(null)).toBeNull();
  });
});
