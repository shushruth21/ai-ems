import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { createAuthEmulator, type AuthEmulator, type SentEmail } from "./server";
import { totp } from "./totp";

let emulator: AuthEmulator;
let base: string;

function client(flowType: "implicit" | "pkce" = "implicit"): SupabaseClient {
  const store = new Map<string, string>();
  return createClient(base, "test-publishable-key", {
    auth: {
      flowType,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, v),
        removeItem: (k) => void store.delete(k),
      },
    },
  });
}

async function hook<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}/auth/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json" },
  });
  return (await res.json()) as T;
}

const lastEmail = async (to: string) => (await hook<SentEmail[]>(`/__emails?to=${to}`)).at(-1)!;

beforeAll(async () => {
  emulator = createAuthEmulator();
  base = await emulator.listen();
});
afterAll(() => emulator.close());
beforeEach(() => hook("/__reset", { method: "POST" }));

describe("auth emulator (driven by supabase-js)", () => {
  it("signs up, requires confirmation, verifies by token hash, then signs in", async () => {
    const sb = client();
    const signUp = await sb.auth.signUp({
      email: "New@Example.test",
      password: "correct horse battery",
      options: { data: { full_name: "New Person" }, emailRedirectTo: "http://app.test/account" },
    });
    expect(signUp.error).toBeNull();
    expect(signUp.data.session).toBeNull();
    expect(signUp.data.user?.email).toBe("new@example.test");

    const early = await sb.auth.signInWithPassword({
      email: "new@example.test",
      password: "correct horse battery",
    });
    expect(early.error?.code).toBe("email_not_confirmed");

    const mail = await lastEmail("new@example.test");
    expect(mail).toMatchObject({ kind: "signup", redirectTo: "http://app.test/account" });
    const verified = await sb.auth.verifyOtp({ type: "email", token_hash: mail.tokenHash });
    expect(verified.error).toBeNull();
    expect(verified.data.session?.access_token).toBeTruthy();

    const reused = await sb.auth.verifyOtp({ type: "email", token_hash: mail.tokenHash });
    expect(reused.error?.code).toBe("otp_expired");

    const signIn = await sb.auth.signInWithPassword({
      email: "new@example.test",
      password: "correct horse battery",
    });
    expect(signIn.error).toBeNull();
  });

  it("returns an indistinguishable response for existing emails", async () => {
    await hook("/__users", {
      method: "POST",
      body: JSON.stringify({ email: "taken@example.test", password: "secret123" }),
    });
    const res = await client().auth.signUp({
      email: "taken@example.test",
      password: "whatever123",
    });
    expect(res.error).toBeNull();
    expect(res.data.user?.identities).toEqual([]);
  });

  it("verifies ES256 access tokens through getClaims (JWKS)", async () => {
    await hook("/__users", {
      method: "POST",
      body: JSON.stringify({ email: "a@example.test", password: "secret123" }),
    });
    const sb = client();
    await sb.auth.signInWithPassword({ email: "a@example.test", password: "secret123" });
    const { data, error } = await sb.auth.getClaims();
    expect(error).toBeNull();
    expect(data?.header.alg).toBe("ES256");
    expect(data?.claims).toMatchObject({
      email: "a@example.test",
      aal: "aal1",
      role: "authenticated",
    });
  });

  it("rejects bad credentials with a stable error code", async () => {
    const res = await client().auth.signInWithPassword({
      email: "nobody@example.test",
      password: "x",
    });
    expect(res.error?.code).toBe("invalid_credentials");
  });

  it("runs magic link and recovery flows", async () => {
    await hook("/__users", {
      method: "POST",
      body: JSON.stringify({ email: "m@example.test", password: "secret123" }),
    });
    const sb = client();
    expect(
      (
        await sb.auth.signInWithOtp({
          email: "m@example.test",
          options: { shouldCreateUser: false },
        })
      ).error,
    ).toBeNull();
    const link = await lastEmail("m@example.test");
    expect(link.kind).toBe("magiclink");
    expect(
      (await sb.auth.verifyOtp({ type: "magiclink", token_hash: link.tokenHash })).error,
    ).toBeNull();

    await sb.auth.resetPasswordForEmail("m@example.test", {
      redirectTo: "http://app.test/auth/confirm",
    });
    const recovery = await lastEmail("m@example.test");
    expect(recovery.kind).toBe("recovery");
    expect(
      (await sb.auth.verifyOtp({ type: "recovery", token_hash: recovery.tokenHash })).error,
    ).toBeNull();
    expect((await sb.auth.updateUser({ password: "secret123" })).error?.code).toBe("same_password");
    expect((await sb.auth.updateUser({ password: "brand new secret" })).error).toBeNull();
    const again = await client().auth.signInWithPassword({
      email: "m@example.test",
      password: "brand new secret",
    });
    expect(again.error).toBeNull();
  });

  it("enrolls TOTP, raises the session to aal2 and requires aal2 to unenroll", async () => {
    await hook("/__users", {
      method: "POST",
      body: JSON.stringify({ email: "t@example.test", password: "secret123" }),
    });
    const sb = client();
    await sb.auth.signInWithPassword({ email: "t@example.test", password: "secret123" });

    const enroll = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "Phone" });
    expect(enroll.error).toBeNull();
    const factor = enroll.data!;
    expect(factor.type === "totp" && factor.totp.qr_code.startsWith("data:image/svg+xml")).toBe(
      true,
    );
    const secret = factor.type === "totp" ? factor.totp.secret : "";

    const bad = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: "000000" });
    expect(bad.error?.code).toBe("mfa_verification_failed");
    const ok = await sb.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(secret) });
    expect(ok.error).toBeNull();

    const aal = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    expect(aal.data).toMatchObject({ currentLevel: "aal2", nextLevel: "aal2" });

    // A fresh password sign-in is aal1 with nextLevel aal2.
    const other = client();
    await other.auth.signInWithPassword({ email: "t@example.test", password: "secret123" });
    expect((await other.auth.mfa.getAuthenticatorAssuranceLevel()).data).toMatchObject({
      currentLevel: "aal1",
      nextLevel: "aal2",
    });
    expect((await other.auth.mfa.unenroll({ factorId: factor.id })).error?.code).toBe(
      "insufficient_aal",
    );
    expect((await sb.auth.mfa.unenroll({ factorId: factor.id })).error).toBeNull();
  });

  it("completes OAuth with PKCE", async () => {
    const sb = client("pkce");
    const { data } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "http://app.test/auth/callback", skipBrowserRedirect: true },
    });
    const res = await fetch(data.url!, { redirect: "manual" });
    expect(res.status).toBe(303);
    const code = new URL(res.headers.get("location")!).searchParams.get("code")!;
    const exchanged = await sb.auth.exchangeCodeForSession(code);
    expect(exchanged.error).toBeNull();
    expect(exchanged.data.user?.email).toBe("google.user@example.test");

    // Codes are single use.
    expect((await sb.auth.exchangeCodeForSession(code)).error).not.toBeNull();
  });

  it("signs out other sessions with scope=others", async () => {
    await hook("/__users", {
      method: "POST",
      body: JSON.stringify({ email: "s@example.test", password: "secret123" }),
    });
    const first = client();
    const second = client();
    await first.auth.signInWithPassword({ email: "s@example.test", password: "secret123" });
    await second.auth.signInWithPassword({ email: "s@example.test", password: "secret123" });
    await first.auth.signOut({ scope: "others" });
    expect((await first.auth.getUser()).error).toBeNull();
    expect((await second.auth.getUser()).error).not.toBeNull();
  });
});

describe("persistence and admin API", () => {
  it("keeps users, sessions and the signing key across restarts", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const stateFile = join(mkdtempSync(join(tmpdir(), "emu-")), "state.json");

    const first = createAuthEmulator({ stateFile });
    const url1 = await first.listen();
    const admin = createClient(url1, "secret", { auth: { persistSession: false } });
    const created = await admin.auth.admin.createUser({
      email: "keep@example.test",
      password: "secret123",
      email_confirm: true,
      user_metadata: { full_name: "Keep Me" },
    });
    expect(created.error).toBeNull();
    const signIn = await createClient(url1, "k", {
      auth: { persistSession: false },
    }).auth.signInWithPassword({
      email: "keep@example.test",
      password: "secret123",
    });
    const token = signIn.data.session!.access_token;
    await first.close();

    const second = createAuthEmulator({ stateFile });
    const url2 = await second.listen();
    const sb = createClient(url2, "k", { auth: { persistSession: false } });
    const got = await sb.auth.getUser(token);
    expect(got.error).toBeNull();
    expect(got.data.user?.email).toBe("keep@example.test");
    expect((await sb.auth.getClaims(token)).error).toBeNull();
    const list = await createClient(url2, "secret", {
      auth: { persistSession: false },
    }).auth.admin.listUsers();
    expect(list.data.users.map((u) => u.email)).toContain("keep@example.test");
    await second.close();
  });
});
