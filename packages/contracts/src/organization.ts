import { z } from "zod";

import { checkSlug, type SlugProblem } from "@ai-ems/domain/organization/slug";

import { emailSchema } from "./auth";

/** Input contracts for organizations, members and invitations. */

export const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "NZD",
  "CHF",
  "SEK",
  "NOK",
  "DKK",
  "PLN",
  "CZK",
  "JPY",
  "CNY",
  "HKD",
  "SGD",
  "INR",
  "AED",
  "SAR",
  "ZAR",
  "BRL",
  "MXN",
] as const;
export const currencySchema = z.enum(CURRENCIES, { error: "Choose a currency" });

export function isTimeZone(value: string): boolean {
  if (value === "UTC") return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
export const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(isTimeZone, "Choose a valid time zone");

export const LOCALES = [
  "en-US",
  "en-GB",
  "en-IN",
  "en-AU",
  "de-DE",
  "fr-FR",
  "es-ES",
  "nl-NL",
] as const;
export const localeSchema = z.enum(LOCALES);

const SLUG_MESSAGES: Record<SlugProblem, string> = {
  too_short: "Use at least 3 characters",
  too_long: "Use at most 40 characters",
  invalid: "Use lowercase letters, numbers and single hyphens (not at the start or end)",
  reserved: "That address is reserved. Try another.",
};

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .superRefine((value, ctx) => {
    const problem = checkSlug(value);
    if (problem) ctx.addIssue({ code: "custom", message: SLUG_MESSAGES[problem] });
  });

const orgName = z
  .string()
  .trim()
  .min(2, "Enter at least 2 characters")
  .max(80, "Use at most 80 characters");

export const createOrganizationSchema = z.object({
  name: orgName,
  slug: slugSchema,
  currency: currencySchema,
  timezone: timeZoneSchema,
});

export const updateOrganizationSchema = z.object({
  name: orgName,
  legalName: z.string().trim().max(160, "Use at most 160 characters").optional().or(z.literal("")),
  taxId: z.string().trim().max(40, "Use at most 40 characters").optional().or(z.literal("")),
  currency: currencySchema,
  timezone: timeZoneSchema,
  locale: localeSchema,
});

export const orgSecuritySchema = z.object({ requireMfa: z.boolean() });

export const roleKeySchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, "Choose a role");

export const inviteMemberSchema = z.object({
  email: emailSchema,
  roleKey: roleKeySchema,
});

export const changeMemberRoleSchema = z.object({
  membershipId: z.string().min(1),
  roleKey: roleKeySchema,
});

export const membershipIdSchema = z.object({ membershipId: z.string().min(1) });
export const invitationIdSchema = z.object({ invitationId: z.string().min(1) });

/** Invitation tokens are 32 random bytes, base64url (43 chars). */
export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.input<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.input<typeof inviteMemberSchema>;
