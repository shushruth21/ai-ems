import { PlatformError, type DbOrTx, type Tx } from "../platform/types";
import type { TenantDb } from "../tenant";

/**
 * CRM repositories take a **tenant-scoped** client: every read is filtered by
 * the organization and every write stamped with it (see src/tenant.ts).
 */
export type CrmDb = TenantDb;

type TransactionFn = Extract<Parameters<TenantDb["$transaction"]>[0], (client: never) => unknown>;
/** The client `TenantDb.$transaction` hands to its callback (also scoped). */
export type CrmTx = Parameters<TransactionFn>[0];

/**
 * The scoped client is the same Prisma client underneath — the extension only
 * rewrites arguments — but its type is a different shape, so the platform
 * helpers (audit, outbox, sequences), which take the plain types, can't see
 * it. Re-labelling happens here, once, rather than duplicating those helpers.
 * Those helpers always pass `organizationId` explicitly, so nothing is lost.
 */
export function platformClient(db: CrmDb | CrmTx): DbOrTx {
  return db as unknown as DbOrTx;
}

export function platformTx(tx: CrmTx): Tx {
  return tx as unknown as Tx;
}

export interface CrmActor {
  organizationId: string;
  profileId: string;
  /** Holds `crm.lead.assign`: may work on anyone's leads, not just their own. */
  canAssign: boolean;
  ip?: string | null;
  userAgent?: string | null;
}

export { PlatformError };
