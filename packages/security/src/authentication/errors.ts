/**
 * Maps Supabase Auth error codes to safe, user-facing messages.
 * Messages never reveal whether an account exists (no user enumeration).
 */
export type AuthErrorKind =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "weak_password"
  | "same_password"
  | "mfa_failed"
  | "link_invalid"
  | "reauthentication_required"
  | "signup_disabled"
  | "unknown";

export interface SafeAuthError {
  kind: AuthErrorKind;
  message: string;
  /** Field the message belongs to, when it is about a specific input. */
  field?: "password" | "code";
}

const CODE_TO_KIND: Record<string, AuthErrorKind> = {
  invalid_credentials: "invalid_credentials",
  user_not_found: "invalid_credentials",
  email_not_confirmed: "email_not_confirmed",
  over_request_rate_limit: "rate_limited",
  over_email_send_rate_limit: "rate_limited",
  over_sms_send_rate_limit: "rate_limited",
  weak_password: "weak_password",
  same_password: "same_password",
  mfa_verification_failed: "mfa_failed",
  mfa_challenge_expired: "mfa_failed",
  mfa_factor_not_found: "mfa_failed",
  otp_expired: "link_invalid",
  bad_code_verifier: "link_invalid",
  flow_state_not_found: "link_invalid",
  flow_state_expired: "link_invalid",
  reauthentication_needed: "reauthentication_required",
  insufficient_aal: "reauthentication_required",
  session_not_found: "reauthentication_required",
  signup_disabled: "signup_disabled",
  email_provider_disabled: "signup_disabled",
  // Deliberately generic: revealing this would allow enumeration.
  user_already_exists: "unknown",
  email_exists: "unknown",
};

const MESSAGES: Record<AuthErrorKind, SafeAuthError> = {
  invalid_credentials: { kind: "invalid_credentials", message: "Email or password is incorrect." },
  email_not_confirmed: {
    kind: "email_not_confirmed",
    message: "Confirm your email address first. We can send a new link.",
  },
  rate_limited: {
    kind: "rate_limited",
    message: "Too many attempts. Wait a few minutes and try again.",
  },
  weak_password: {
    kind: "weak_password",
    field: "password",
    message:
      "Choose a stronger password — this one is too easy to guess or has appeared in a data breach.",
  },
  same_password: {
    kind: "same_password",
    field: "password",
    message: "Choose a password you haven't used here.",
  },
  mfa_failed: {
    kind: "mfa_failed",
    field: "code",
    message: "That code didn't work. Check your app and try again.",
  },
  link_invalid: {
    kind: "link_invalid",
    message: "This link is invalid or has expired. Request a new one.",
  },
  reauthentication_required: {
    kind: "reauthentication_required",
    message: "For your security, sign in again to continue.",
  },
  signup_disabled: { kind: "signup_disabled", message: "New sign-ups are currently closed." },
  unknown: { kind: "unknown", message: "Something went wrong. Please try again." },
};

export function toSafeAuthError(error: unknown): SafeAuthError {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : undefined;
  const kind = (code && CODE_TO_KIND[code]) || "unknown";
  return MESSAGES[kind];
}

export function authErrorMessage(kind: AuthErrorKind): SafeAuthError {
  return MESSAGES[kind];
}
