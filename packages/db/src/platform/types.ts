import type { Prisma, PrismaClient } from "../generated/prisma/client";

/**
 * Platform repositories take the root client (or a transaction) explicitly.
 * They run before a tenant is known (sign-up, org switcher, invitations) and
 * always filter by the ids they are given.
 */
export type Db = PrismaClient;
export type Tx = Prisma.TransactionClient;
export type DbOrTx = Db | Tx;

export class PlatformError extends Error {
  constructor(
    readonly code:
      | "slug_taken"
      | "not_found"
      | "forbidden"
      | "invalid_state"
      | "email_mismatch"
      | "already_member"
      | "limit_reached",
    message: string,
  ) {
    super(message);
    this.name = "PlatformError";
  }
}
