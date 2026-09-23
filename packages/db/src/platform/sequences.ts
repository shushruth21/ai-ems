import { allocate, type SequenceState } from "@ai-ems/domain/numbering/document-number";

import { PlatformError, type Tx } from "./types";

/**
 * Gap-free per-tenant document numbers (LEAD-2026-00042).
 *
 * The row is locked with `SELECT … FOR UPDATE` inside the caller's
 * transaction, so two people creating a document at the same moment queue
 * rather than collide. Call it in the same transaction as the insert: if that
 * rolls back, the number is released with it.
 */
export async function nextDocumentNumber(
  tx: Tx,
  organizationId: string,
  key: string,
  now = new Date(),
): Promise<string> {
  const rows = await tx.$queryRaw<
    Array<{
      prefix: string;
      next_value: number;
      padding: number;
      reset_yearly: boolean;
      year: number | null;
    }>
  >`
    select prefix, next_value, padding, reset_yearly, year
      from public.sequences
     where organization_id = ${organizationId} and key = ${key}
       for update`;
  const row = rows[0];
  if (!row) throw new PlatformError("not_found", `No "${key}" sequence in this workspace.`);

  const state: SequenceState = {
    prefix: row.prefix,
    nextValue: row.next_value,
    padding: row.padding,
    resetYearly: row.reset_yearly,
    year: row.year,
  };
  const { number, next } = allocate(state, now);
  await tx.sequence.update({
    where: { organizationId_key: { organizationId, key } },
    data: { nextValue: next.nextValue, year: next.year },
  });
  return number;
}
