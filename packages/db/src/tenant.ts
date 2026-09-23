import "server-only";

import { prisma } from "./prisma";
import { scopeToTenant, type TenantClient } from "./tenant-client";

/**
 * Tenant-scoped Prisma client for the app: the singleton, bound to one
 * organization. Use unchecked inputs (`organizationId` / `*Id` scalars)
 * rather than nested `connect` on tenant models.
 */
export function getTenantDb(organizationId: string): TenantDb {
  return scopeToTenant(prisma, organizationId);
}

export type TenantDb = TenantClient;
