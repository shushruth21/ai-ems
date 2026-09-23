import { z } from "zod";

/** Input contracts for accounts, contacts, leads and activities. */

export const ACCOUNT_TYPES = ["CUSTOMER", "PROSPECT", "PARTNER", "OTHER"] as const;
export const LEAD_SOURCES = [
  "WEBSITE",
  "REFERRAL",
  "WALK_IN",
  "PHONE",
  "EMAIL",
  "SOCIAL",
  "PAID_ADS",
  "PARTNER",
  "EVENT",
  "OTHER",
] as const;
export const ACTIVITY_TYPES = ["CALL", "EMAIL", "MEETING", "MESSAGE", "NOTE", "VISIT"] as const;
export const LEAD_ACTIONS = [
  "contact",
  "qualify",
  "propose",
  "win",
  "lose",
  "disqualify",
  "reopen",
] as const;

const name = z.string().trim().min(2, "Use at least 2 characters").max(120);
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/**
 * Money and dates stay **strings** through validation and are converted at the
 * edge with `toAmount` / `toDate`. A schema that transformed them would hand
 * React Hook Form a number where its inputs expect text, and the second
 * validation pass would reject the form's own output.
 */
const amount = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{1,3}(,\d{3})*(\.\d{1,2})?$|^\d{1,12}(\.\d{1,2})?$/.test(value),
    "Use a number like 2500",
  );

const optionalDate = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true;
    // Round-trip, so 2026-02-31 is rejected rather than rolled into March.
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Use a real date (YYYY-MM-DD)");

/** "12,500.50" → 12500.5; "" → null. */
export function toAmount(value: string | undefined): number | null {
  const cleaned = (value ?? "").replaceAll(",", "").trim();
  return cleaned === "" ? null : Number(cleaned);
}

/** "2026-10-01" → that day at midnight UTC; "" → null. */
export function toDate(value: string | undefined): Date | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : new Date(`${trimmed}T00:00:00Z`);
}

export const accountSchema = z.object({
  name,
  type: z.enum(ACCOUNT_TYPES).default("PROSPECT"),
  industry: optionalText(80),
  website: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^https?:\/\/\S+\.\S+$/.test(v), "Use a full URL (https://…)")
    .optional()
    .or(z.literal("")),
  taxId: optionalText(40),
});

export const accountIdSchema = z.object({ accountId: z.string().min(1) });

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(80),
  lastName: optionalText(80),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Use a valid email address")
    .optional()
    .or(z.literal("")),
  phone: optionalText(40),
  jobTitle: optionalText(80),
  accountId: z.string().max(40).optional().or(z.literal("")),
  marketingOptIn: z.boolean().default(false),
});

export const contactIdSchema = z.object({ contactId: z.string().min(1) });

export const createLeadSchema = z.object({
  title: name,
  source: z.enum(LEAD_SOURCES).default("OTHER"),
  campaign: optionalText(80),
  accountId: z.string().max(40).optional().or(z.literal("")),
  contactId: z.string().max(40).optional().or(z.literal("")),
  estimatedValue: amount.optional(),
  nextFollowUpAt: optionalDate.optional(),
});

export const updateLeadSchema = createLeadSchema.extend({ leadId: z.string().min(1) });
export const leadIdSchema = z.object({ leadId: z.string().min(1) });

export const transitionLeadSchema = z.object({
  leadId: z.string().min(1),
  action: z.enum(LEAD_ACTIONS),
  reason: optionalText(200),
});

export const assignLeadSchema = z.object({
  leadId: z.string().min(1),
  /** Empty means "leave it unassigned". */
  ownerId: z.string().max(60).optional().or(z.literal("")),
});

export const logActivitySchema = z.object({
  leadId: z.string().min(1),
  type: z.enum(ACTIVITY_TYPES).default("NOTE"),
  subject: z.string().trim().min(2, "Say what happened").max(140),
  body: optionalText(2000),
  outcome: optionalText(120),
  nextFollowUpAt: optionalDate.optional(),
});

export const leadFilterSchema = z.object({
  status: z.string().trim().max(20).optional().or(z.literal("")),
  owner: z.string().trim().max(60).optional().or(z.literal("")),
  q: z.string().trim().max(80).optional().or(z.literal("")),
});

export type AccountInput = z.input<typeof accountSchema>;
export type ContactInput = z.input<typeof contactSchema>;
export type CreateLeadInput = z.input<typeof createLeadSchema>;
export type UpdateLeadInput = z.input<typeof updateLeadSchema>;
export type LogActivityInput = z.input<typeof logActivitySchema>;
export type LeadFilterInput = z.input<typeof leadFilterSchema>;
