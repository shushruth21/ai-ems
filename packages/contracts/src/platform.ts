import { z } from "zod";

import { ROLE_NAME_MAX, ROLE_NAME_MIN } from "@ai-ems/domain/organization/role-policy";
import { ALL_PERMISSIONS } from "@ai-ems/security/authorization/permissions";

/** Input contracts for roles, the audit log, notifications and API keys. */

export const permissionKeySchema = z.enum(ALL_PERMISSIONS as [string, ...string[]]);

const roleName = z
  .string()
  .trim()
  .min(ROLE_NAME_MIN, `Use at least ${ROLE_NAME_MIN} characters`)
  .max(ROLE_NAME_MAX, `Use at most ${ROLE_NAME_MAX} characters`);

export const createRoleSchema = z.object({
  name: roleName,
  description: z
    .string()
    .trim()
    .max(200, "Use at most 200 characters")
    .optional()
    .or(z.literal("")),
  permissions: z.array(permissionKeySchema).min(1, "Choose at least one permission").max(200),
});

export const updateRoleSchema = createRoleSchema.extend({ roleId: z.string().min(1) });
export const roleIdSchema = z.object({ roleId: z.string().min(1) });

/** YYYY-MM-DD that is also a real calendar date. */
const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "That date doesn't exist");

/** Audit log filters. Everything is optional; the UI passes what the user picked. */
export const auditFilterSchema = z.object({
  action: z.string().trim().max(64).optional().or(z.literal("")),
  entityType: z.string().trim().max(64).optional().or(z.literal("")),
  actorId: z.string().trim().max(64).optional().or(z.literal("")),
  from: isoDate.optional().or(z.literal("")),
  to: isoDate.optional().or(z.literal("")),
  cursor: z.string().regex(/^\d+$/).optional(),
});

export const notificationIdSchema = z.object({ notificationId: z.string().min(1) });

export const API_KEY_SCOPES = ["read", "write"] as const;
export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);

export const createApiKeySchema = z.object({
  name: z.string().trim().min(2, "Name the key so you can recognise it").max(60),
  scopes: z.array(apiKeyScopeSchema).min(1, "Choose at least one scope"),
  expiresInDays: z.coerce.number<string>().int().min(1).max(365).optional(),
});

export const apiKeyIdSchema = z.object({ apiKeyId: z.string().min(1) });

export type CreateRoleInput = z.input<typeof createRoleSchema>;
export type UpdateRoleInput = z.input<typeof updateRoleSchema>;
export type AuditFilterInput = z.input<typeof auditFilterSchema>;
export type CreateApiKeyInput = z.input<typeof createApiKeySchema>;
