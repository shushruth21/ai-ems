import { describe, expect, it } from "vitest";

import { needsMfa, toAssuranceLevel } from "./aal";
import { authErrorMessage, toSafeAuthError } from "./errors";
import { hashIdentity } from "./identity";
import {
  MemoryRateLimitStore,
  RateLimiter,
  authRateLimitKeys,
  AUTH_RATE_LIMITS,
} from "./rate-limit";
import { authCallbackUrl, authConfirmUrl } from "./redirects";

describe("RateLimiter", () => {
  function setup() {
    let now = new Date("2026-01-01T00:00:00Z");
    const limiter = new RateLimiter(new MemoryRateLimitStore(), () => now);
    return { limiter, advance: (s: number) => (now = new Date(now.getTime() + s * 1000)) };
  }

  it("allows up to the limit, then denies with retry-after", async () => {
    const { limiter, advance } = setup();
    const rule = { limit: 3, windowSeconds: 60 };
    for (let i = 2; i >= 0; i--) {
      expect(await limiter.consume("k", rule)).toEqual({
        allowed: true,
        remaining: i,
        retryAfterSeconds: 0,
      });
    }
    advance(20);
    expect(await limiter.consume("k", rule)).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 40,
    });
    advance(40);
    expect((await limiter.consume("k", rule)).allowed).toBe(true);
  });

  it("isolates keys and supports reset", async () => {
    const { limiter } = setup();
    const rule = { limit: 1, windowSeconds: 60 };
    await limiter.consume("a", rule);
    expect((await limiter.consume("a", rule)).allowed).toBe(false);
    expect((await limiter.consume("b", rule)).allowed).toBe(true);
    await limiter.reset("a");
    expect((await limiter.consume("a", rule)).allowed).toBe(true);
  });

  it("consumeAll denies when any key is exhausted and counts all keys", async () => {
    const { limiter } = setup();
    const keys = authRateLimitKeys("magic-link", "1.2.3.4", "victim");
    const perIdentity = AUTH_RATE_LIMITS["magic-link"].perIdentity.limit;
    for (let i = 0; i < perIdentity; i++)
      expect((await limiter.consumeAll(keys)).allowed).toBe(true);
    const denied = await limiter.consumeAll(keys);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBe(600);
    // Same IP, other identity: still allowed (IP budget is larger).
    expect(
      (await limiter.consumeAll(authRateLimitKeys("magic-link", "1.2.3.4", "other"))).allowed,
    ).toBe(true);
  });
});

describe("toSafeAuthError", () => {
  it("maps known codes", () => {
    expect(toSafeAuthError({ code: "invalid_credentials" }).kind).toBe("invalid_credentials");
    expect(toSafeAuthError({ code: "over_request_rate_limit" }).kind).toBe("rate_limited");
    expect(toSafeAuthError({ code: "weak_password" }).field).toBe("password");
    expect(toSafeAuthError({ code: "mfa_verification_failed" }).field).toBe("code");
    expect(toSafeAuthError({ code: "otp_expired" }).kind).toBe("link_invalid");
  });

  it("does not reveal account existence", () => {
    expect(toSafeAuthError({ code: "user_not_found" })).toEqual(
      authErrorMessage("invalid_credentials"),
    );
    expect(toSafeAuthError({ code: "user_already_exists" }).kind).toBe("unknown");
  });

  it("falls back for unknown shapes", () => {
    expect(toSafeAuthError(new Error("boom")).kind).toBe("unknown");
    expect(toSafeAuthError(null).kind).toBe("unknown");
    expect(toSafeAuthError({ code: 42 }).kind).toBe("unknown");
  });
});

describe("assurance level", () => {
  it("requires MFA only when a verified factor exists and the session is aal1", () => {
    expect(needsMfa({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
    expect(needsMfa({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(needsMfa({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
    expect(needsMfa(null)).toBe(false);
    expect(toAssuranceLevel("aal3")).toBeNull();
  });
});

describe("hashIdentity", () => {
  const secret = "0123456789abcdef-secret";
  it("normalizes and is keyed", () => {
    expect(hashIdentity(" A@Example.com ", secret)).toBe(hashIdentity("a@example.com", secret));
    expect(hashIdentity("a@example.com", secret)).not.toBe(
      hashIdentity("a@example.com", `${secret}x`),
    );
    expect(hashIdentity("a@example.com", secret)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("rejects short secrets", () => {
    expect(() => hashIdentity("a", "short")).toThrow();
  });
});

describe("redirect builders", () => {
  it("builds absolute callback URLs", () => {
    expect(authCallbackUrl("https://app.test", "/account")).toBe(
      "https://app.test/auth/callback?next=%2Faccount",
    );
    expect(authConfirmUrl("https://app.test/")).toBe("https://app.test/auth/confirm");
  });
});

describe("isSessionGone", () => {
  it("separates revoked sessions from outages", async () => {
    const { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } =
      await import("@supabase/supabase-js");
    const { isSessionGone } = await import("./session-errors");
    expect(isSessionGone(new AuthSessionMissingError())).toBe(true);
    expect(isSessionGone(new AuthApiError("gone", 403, "bad_jwt"))).toBe(true);
    expect(isSessionGone(new AuthApiError("boom", 400, "validation_failed"))).toBe(false);
    expect(isSessionGone(new AuthRetryableFetchError("down", 503))).toBe(false);
    expect(isSessionGone(new Error("x"))).toBe(false);
  });
});
