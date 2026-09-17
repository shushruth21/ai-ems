import "server-only";

import { prisma } from "./prisma";
import { scopeArgs } from "./tenant-scope";

/**
 * Tenant-scoped Prisma client. Every read is filtered by organizationId and
 * every write is stamped with it. Use unchecked inputs (`organizationId` /
 * `*Id` scalars) rather than nested `connect` on tenant models.
 *
 * Raw SQL ($queryRaw / $executeRaw) is not scoped — avoid it in feature code.
 * Postgres RLS remains the second line of defense.
 */
export function getTenantDb(organizationId: string) {
  return prisma.$extends({
    name: "tenant-scope",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scoped = scopeArgs(
            model,
            operation,
            args as Record<string, unknown>,
            organizationId,
          );
          return query(scoped as typeof args);
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof getTenantDb>;
