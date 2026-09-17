import type { Permission } from "./permissions";

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(public readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

export interface RequestContext {
  userId: string;
  organizationId: string;
  permissions: ReadonlySet<Permission>;
}

export function can(ctx: Pick<RequestContext, "permissions">, permission: Permission): boolean {
  return ctx.permissions.has(permission);
}

/** Throws ForbiddenError unless the context holds every listed permission. */
export function authorize(
  ctx: Pick<RequestContext, "permissions">,
  ...required: [Permission, ...Permission[]]
): void {
  for (const permission of required) {
    if (!ctx.permissions.has(permission)) throw new ForbiddenError(permission);
  }
}
