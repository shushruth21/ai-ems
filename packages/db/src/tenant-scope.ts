/**
 * Pure helpers that force every query on a tenant model to be scoped to one
 * organization. Used by the Prisma client extension in ./tenant.ts.
 */

/** Models that are NOT tenant-owned (no organizationId column, or the tenant itself). */
export const GLOBAL_MODELS = new Set(["Organization", "Profile", "Permission", "RolePermission"]);

const WHERE_OPS = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "delete",
  "deleteMany",
]);

const CREATE_OPS = new Set(["create", "createMany", "createManyAndReturn"]);

export class TenantScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantScopeError";
  }
}

type Args = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown };

function stampData(data: unknown, organizationId: string): unknown {
  if (Array.isArray(data)) return data.map((row) => stampData(row, organizationId));
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    if (row.organizationId !== undefined && row.organizationId !== organizationId) {
      throw new TenantScopeError("Refusing to write a row for a different organization");
    }
    return { ...row, organizationId };
  }
  return data;
}

function scopeWhere(where: Record<string, unknown> | undefined, organizationId: string) {
  if (where?.organizationId !== undefined && where.organizationId !== organizationId) {
    throw new TenantScopeError("Refusing to query a different organization");
  }
  return { ...(where ?? {}), organizationId };
}

export function scopeArgs(
  model: string | undefined,
  operation: string,
  args: Args | undefined,
  organizationId: string,
): Args | undefined {
  if (!model || GLOBAL_MODELS.has(model)) return args;
  if (!organizationId) throw new TenantScopeError("Missing organizationId for tenant query");

  const next: Args = { ...(args ?? {}) };

  if (WHERE_OPS.has(operation)) {
    next.where = scopeWhere(next.where, organizationId);
    if (operation.startsWith("update") && next.data !== undefined) {
      const data = next.data as Record<string, unknown>;
      if (data.organizationId !== undefined && data.organizationId !== organizationId) {
        throw new TenantScopeError("Changing organizationId is not allowed");
      }
    }
    return next;
  }

  if (CREATE_OPS.has(operation)) {
    next.data = stampData(next.data, organizationId);
    return next;
  }

  if (operation === "upsert") {
    next.where = scopeWhere(next.where, organizationId);
    next.create = stampData(next.create, organizationId);
    return next;
  }

  throw new TenantScopeError(`Operation "${operation}" is not allowed on tenant model ${model}`);
}
