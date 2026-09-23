import type { PrismaClient } from "./generated/prisma/client";
import { scopeArgs } from "./tenant-scope";

/**
 * Wraps any Prisma client so every read is filtered by `organizationId` and
 * every write stamped with it. Kept separate from ./tenant.ts (which binds the
 * app's singleton and is server-only) so tests can scope their own client.
 *
 * Raw SQL ($queryRaw / $executeRaw) is not scoped — avoid it in feature code.
 * Postgres RLS remains the second line of defense.
 */
export function scopeToTenant(client: PrismaClient, organizationId: string) {
  return client.$extends({
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

export type TenantClient = ReturnType<typeof scopeToTenant>;
