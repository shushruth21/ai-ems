"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import {
  DEFAULT_AFTER_LOGIN,
  LOGIN_PATH,
  MFA_PATH,
  safeRedirectPath,
  withNext,
} from "@/lib/routes";
import { redirectTo } from "@/server/redirect";
import { appUrl } from "@/server/auth/app-url";
import { auditAuthEvent } from "@/server/auth/audit";
import { limitAuthAttempt } from "@/server/auth/rate-limit";
import { requireSession } from "@/server/auth/session";
import {
  changePasswordSchema,
  confirmLinkSchema,
  forgotPasswordSchema,
  magicLinkSchema,
  mfaEnrollConfirmSchema,
  mfaVerifySchema,
  oauthProviderSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  toFieldErrors,
  type ActionResult,
} from "@ai-ems/contracts/auth";
import { publicEnv } from "@ai-ems/config/env";
import { isEnabled } from "@ai-ems/config/flags";
import { authErrorMessage, toSafeAuthError } from "@ai-ems/security/authentication/errors";
import { getSupabaseServerClient } from "@ai-ems/security/authentication/supabase/server";

/*
 * Authentication server actions. Every action:
 *   1. validates input with the shared Zod contract,
 *   2. applies per-IP and per-identity rate limits,
 *   3. calls Supabase Auth through the cookie-bound server client,
 *   4. records a security event, and
 *   5. returns a safe, non-enumerating error or redirects.
 */

type Fail = Extract<ActionResult, { ok: false }>;

const invalid = (error: Parameters<typeof toFieldErrors>[0]): Fail => ({
  ok: false,
  fieldErrors: toFieldErrors(error),
});

function rateLimited(retryAfterSeconds: number): Fail {
  return {
    ok: false,
    formError: authErrorMessage("rate_limited").message,
    retryAfterSeconds,
  };
}

function fromAuthError(error: unknown): Fail {
  const safe = toSafeAuthError(error);
  return safe.field
    ? { ok: false, fieldErrors: { [safe.field]: safe.message } }
    : { ok: false, formError: safe.message };
}

const GENERIC_EMAIL_SENT =
  "If an account exists for that address, we've sent an email with next steps.";

// ─── Sign in ──────────────────────────────────────────────────────────────

export async function signInWithPassword(input: unknown): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, password, next } = parsed.data;

  const limit = await limitAuthAttempt("sign-in", email);
  if (!limit.allowed) {
    await auditAuthEvent("RATE_LIMITED", { email, metadata: { action: "sign-in" } });
    return rateLimited(limit.retryAfterSeconds);
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    await auditAuthEvent("SIGN_IN_FAILED", {
      email,
      metadata: { reason: toSafeAuthError(error).kind },
    });
    return fromAuthError(error);
  }

  await auditAuthEvent("SIGN_IN_SUCCEEDED", {
    profileId: data.user.id,
    email,
    metadata: { method: "password" },
  });
  const hasFactor = (data.user.factors ?? []).some((f) => f.status === "verified");
  redirectTo(hasFactor ? withNext(MFA_PATH, next) : safeRedirectPath(next));
}

export async function requestMagicLink(input: unknown): Promise<ActionResult> {
  if (!isEnabled("MAGIC_LINK"))
    return { ok: false, formError: "Email sign-in links are disabled." };
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, next } = parsed.data;

  const limit = await limitAuthAttempt("magic-link", email);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: appUrl(safeRedirectPath(next)) },
  });
  await auditAuthEvent("MAGIC_LINK_REQUESTED", { email });
  // Unknown addresses look exactly like success (no enumeration).
  if (error) {
    const kind = toSafeAuthError(error).kind;
    if (kind === "rate_limited") return rateLimited(60);
    if ((error.status ?? 0) >= 500)
      return { ok: false, formError: authErrorMessage("unknown").message };
  }
  return { ok: true, message: GENERIC_EMAIL_SENT };
}

export async function startOAuth(formData: FormData): Promise<void> {
  const provider = oauthProviderSchema.safeParse(formData.get("provider"));
  const next = safeRedirectPath(String(formData.get("next") ?? ""));
  const flag = provider.data === "google" ? "OAUTH_GOOGLE" : "OAUTH_MICROSOFT";
  if (!provider.success || !isEnabled(flag)) redirectTo(`${LOGIN_PATH}?error=provider_disabled`);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider.data,
    options: {
      redirectTo: appUrl(withNext("/auth/callback", next)),
      scopes: provider.data === "azure" ? "email" : undefined,
    },
  });
  await auditAuthEvent("OAUTH_STARTED", { metadata: { provider: provider.data } });
  if (error || !data.url) redirectTo(`${LOGIN_PATH}?error=oauth_failed`);
  redirectTo(data.url);
}

// ─── Sign up & email links ────────────────────────────────────────────────

export async function signUp(input: unknown): Promise<ActionResult> {
  if (!isEnabled("SIGN_UP"))
    return { ok: false, formError: authErrorMessage("signup_disabled").message };
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email, password, fullName, next } = parsed.data;

  const limit = await limitAuthAttempt("sign-up", email);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: appUrl(safeRedirectPath(next, DEFAULT_AFTER_LOGIN)),
    },
  });
  // Existing-account errors are reported like success to prevent enumeration.
  if (error && !["user_already_exists", "email_exists"].includes(error.code ?? "")) {
    return fromAuthError(error);
  }
  const created = !!data.user && (data.user.identities?.length ?? 0) > 0;
  await auditAuthEvent("SIGN_UP", {
    profileId: created ? data.user?.id : null,
    email,
    metadata: { created },
  });
  redirectTo("/verify-email");
}

export async function confirmEmailLink(input: unknown): Promise<ActionResult> {
  const parsed = confirmLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, formError: authErrorMessage("link_invalid").message };
  const { tokenHash, type, next } = parsed.data;

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) return fromAuthError(error ?? { code: "otp_expired" });

  if (type === "recovery") {
    await auditAuthEvent("PASSWORD_RESET_REQUESTED", {
      profileId: data.user.id,
      metadata: { stage: "link_opened" },
    });
    redirectTo("/reset-password");
  }
  await auditAuthEvent(type === "magiclink" ? "SIGN_IN_SUCCEEDED" : "EMAIL_VERIFIED", {
    profileId: data.user.id,
    metadata: { method: type },
  });
  const hasFactor = (data.user.factors ?? []).some((f) => f.status === "verified");
  redirectTo(hasFactor ? withNext(MFA_PATH, next) : safeRedirectPath(next));
}

// ─── Passwords ────────────────────────────────────────────────────────────

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { email } = parsed.data;

  const limit = await limitAuthAttempt("password-reset", email);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const supabase = await getSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl("/reset-password") });
  await auditAuthEvent("PASSWORD_RESET_REQUESTED", { email, metadata: { stage: "requested" } });
  return { ok: true, message: GENERIC_EMAIL_SENT };
}

/** Sets a new password after a recovery link (the link created the session). */
export async function completePasswordReset(input: unknown): Promise<ActionResult> {
  const user = await requireSession({ next: "/reset-password" });
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const limit = await limitAuthAttempt("password-change", user.id);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fromAuthError(error);

  // A reset means the old password may be compromised: end every other session.
  await supabase.auth.signOut({ scope: "others" });
  await auditAuthEvent("PASSWORD_CHANGED", { profileId: user.id, metadata: { via: "reset" } });
  redirectTo("/account?notice=password-updated");
}

/** Changes the password from account settings; re-verifies the current one first. */
export async function changePassword(input: unknown): Promise<ActionResult> {
  const user = await requireSession();
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const limit = await limitAuthAttempt("password-change", user.id);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  // Verify the current password with a throwaway, non-persisting client so the
  // user's own session is untouched; its extra session is revoked immediately.
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = publicEnv();
  const verifier = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const check = await verifier.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });
  if (check.error) {
    await auditAuthEvent("SIGN_IN_FAILED", {
      profileId: user.id,
      metadata: { reason: "password_change_reauth" },
    });
    return { ok: false, fieldErrors: { currentPassword: "Your current password is incorrect." } };
  }
  await verifier.auth.signOut({ scope: "local" });

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fromAuthError(error);
  await supabase.auth.signOut({ scope: "others" });
  await auditAuthEvent("PASSWORD_CHANGED", { profileId: user.id, metadata: { via: "settings" } });
  revalidatePath("/account");
  return { ok: true, message: "Password updated. Other devices have been signed out." };
}

// ─── Multi-factor authentication ──────────────────────────────────────────

export async function verifyMfa(input: unknown): Promise<ActionResult> {
  const user = await requireSession({ allowMfaPending: true });
  const parsed = mfaVerifySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { factorId, code, next } = parsed.data;
  if (!user.verifiedFactors.some((f) => f.id === factorId)) {
    return { ok: false, formError: authErrorMessage("mfa_failed").message };
  }

  const limit = await limitAuthAttempt("mfa-verify", user.id);
  if (!limit.allowed) {
    await auditAuthEvent("RATE_LIMITED", {
      profileId: user.id,
      metadata: { action: "mfa-verify" },
    });
    return rateLimited(limit.retryAfterSeconds);
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) {
    await auditAuthEvent("MFA_FAILED", { profileId: user.id });
    return fromAuthError(error);
  }
  await auditAuthEvent("MFA_VERIFIED", { profileId: user.id });
  redirectTo(safeRedirectPath(next));
}

export interface TotpEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export async function startTotpEnrollment(): Promise<ActionResult<TotpEnrollment>> {
  const user = await requireSession();
  if (!isEnabled("MFA_TOTP"))
    return { ok: false, formError: "Two-factor authentication is disabled." };
  if (user.verifiedFactors.length > 0) {
    return { ok: false, formError: "An authenticator app is already set up." };
  }

  const supabase = await getSupabaseServerClient();
  // Clear abandoned enrollments so the new factor's name doesn't collide.
  await Promise.all(
    user.pendingFactorIds.map((factorId) => supabase.auth.mfa.unenroll({ factorId })),
  );
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator (${new Date().toISOString().slice(0, 10)})`,
    issuer: publicEnv().NEXT_PUBLIC_APP_NAME,
  });
  if (error || data.type !== "totp") return fromAuthError(error);
  return {
    ok: true,
    data: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    },
  };
}

export async function confirmTotpEnrollment(input: unknown): Promise<ActionResult> {
  const user = await requireSession();
  const parsed = mfaEnrollConfirmSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!user.pendingFactorIds.includes(parsed.data.factorId)) {
    return { ok: false, formError: authErrorMessage("mfa_failed").message };
  }

  const limit = await limitAuthAttempt("mfa-verify", user.id);
  if (!limit.allowed) return rateLimited(limit.retryAfterSeconds);

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify(parsed.data);
  if (error) {
    await auditAuthEvent("MFA_FAILED", { profileId: user.id, metadata: { stage: "enroll" } });
    return fromAuthError(error);
  }
  await auditAuthEvent("MFA_ENROLLED", { profileId: user.id });
  revalidatePath("/account");
  return { ok: true, message: "Two-factor authentication is on." };
}

export async function cancelTotpEnrollment(factorId: string): Promise<ActionResult> {
  const user = await requireSession();
  if (!user.pendingFactorIds.includes(factorId)) return { ok: true };
  const supabase = await getSupabaseServerClient();
  await supabase.auth.mfa.unenroll({ factorId });
  return { ok: true };
}

export async function removeTotpFactor(factorId: string): Promise<ActionResult> {
  const user = await requireSession();
  if (!user.verifiedFactors.some((f) => f.id === factorId)) {
    return { ok: false, formError: "That authenticator was not found." };
  }
  if (user.aal !== "aal2") {
    return { ok: false, formError: authErrorMessage("reauthentication_required").message };
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return fromAuthError(error);
  await auditAuthEvent("MFA_REMOVED", { profileId: user.id });
  revalidatePath("/account");
  return { ok: true, message: "Two-factor authentication is off." };
}

// ─── Sign out ─────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  await supabase.auth.signOut({ scope: "local" });
  if (typeof data?.claims.sub === "string") {
    await auditAuthEvent("SIGNED_OUT", { profileId: data.claims.sub });
  }
  redirectTo(`${LOGIN_PATH}?notice=signed-out`);
}

export async function signOutEverywhere(): Promise<void> {
  const user = await requireSession();
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut({ scope: "global" });
  await auditAuthEvent("SIGNED_OUT_EVERYWHERE", { profileId: user.id });
  redirectTo(`${LOGIN_PATH}?notice=signed-out`);
}
