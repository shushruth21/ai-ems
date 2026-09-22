import { z } from "zod";

import { assessPassword, PASSWORD_MAX_LENGTH } from "./password-policy";

/** Input contracts for authentication flows (shared by forms and server actions). */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .max(254, "Email is too long")
  .pipe(z.email("Enter a valid email address"))
  .transform((v) => v.toLowerCase());

/** Sign-in accepts any existing password — policy is only enforced when setting one. */
const existingPassword = z
  .string()
  .min(1, "Enter your password")
  .max(PASSWORD_MAX_LENGTH, "Password is too long");

export const newPasswordSchema = z.string().superRefine((value, ctx) => {
  const result = assessPassword(value);
  for (const problem of result.problems) ctx.addIssue({ code: "custom", message: problem });
});

/** Relative, same-origin path only (prevents open redirects). */
export const nextPathSchema = z
  .string()
  .max(2048)
  .refine((v) => v.startsWith("/") && !v.startsWith("//") && !v.includes("\\"), "Invalid redirect")
  .optional()
  .catch(undefined);

export const signInSchema = z.object({
  email: emailSchema,
  password: existingPassword,
  next: nextPathSchema,
});

export const magicLinkSchema = z.object({
  email: emailSchema,
  next: nextPathSchema,
});

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120, "Name is too long"),
    email: emailSchema,
    password: z.string().max(PASSWORD_MAX_LENGTH, "Password is too long"),
    acceptTerms: z.boolean().refine((v) => v, "You must accept the terms to continue"),
    next: nextPathSchema,
  })
  .superRefine((data, ctx) => {
    const context = [data.email.split("@")[0] ?? "", ...data.fullName.split(/\s+/)];
    for (const problem of assessPassword(data.password, context).problems) {
      ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    }
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });

export const changePasswordSchema = z
  .object({
    currentPassword: existingPassword,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  })
  .refine((d) => d.password !== d.currentPassword, {
    path: ["password"],
    message: "Choose a password different from your current one",
  });

export const totpCodeSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app"));

export const mfaVerifySchema = z.object({
  factorId: z.string().min(1),
  code: totpCodeSchema,
  next: nextPathSchema,
});

export const mfaEnrollConfirmSchema = z.object({
  factorId: z.string().min(1),
  code: totpCodeSchema,
});

export const oauthProviderSchema = z.enum(["google", "azure"]);

export const emailOtpTypeSchema = z.enum([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

/** Email link confirmation (token hash from the email template). */
export const confirmLinkSchema = z.object({
  tokenHash: z
    .string()
    .min(16)
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid link"),
  type: emailOtpTypeSchema,
  next: nextPathSchema,
});

export type SignInInput = z.input<typeof signInSchema>;
export type MagicLinkInput = z.input<typeof magicLinkSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type MfaVerifyInput = z.input<typeof mfaVerifySchema>;
export type MfaEnrollConfirmInput = z.input<typeof mfaEnrollConfirmSchema>;
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;

/** Uniform result for server actions consumed by forms. */
export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | {
      ok: false;
      formError?: string;
      fieldErrors?: Partial<Record<string, string>>;
      retryAfterSeconds?: number;
    };

/** Flattens a ZodError into first-message-per-field. */
export function toFieldErrors(error: z.ZodError): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
