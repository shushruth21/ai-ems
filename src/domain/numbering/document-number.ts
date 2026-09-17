/** Formats per-tenant document numbers, e.g. SO-2026-00042. */
export interface SequenceState {
  prefix: string;
  nextValue: number;
  padding: number;
  resetYearly: boolean;
  year: number | null;
}

export function formatDocumentNumber(
  prefix: string,
  value: number,
  padding: number,
  year?: number,
): string {
  if (!Number.isInteger(value) || value < 1)
    throw new RangeError("Sequence value must be a positive integer");
  const body = String(value).padStart(padding, "0");
  return year ? `${prefix}-${year}-${body}` : `${prefix}-${body}`;
}

/** Computes the number to issue now and the state to persist afterwards. */
export function allocate(state: SequenceState, now: Date): { number: string; next: SequenceState } {
  const currentYear = now.getUTCFullYear();
  const rollover = state.resetYearly && state.year !== currentYear;
  const value = rollover ? 1 : state.nextValue;
  const year = state.resetYearly ? currentYear : undefined;
  return {
    number: formatDocumentNumber(state.prefix, value, state.padding, year),
    next: { ...state, nextValue: value + 1, year: state.resetYearly ? currentYear : state.year },
  };
}
