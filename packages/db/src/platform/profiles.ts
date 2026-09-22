import type { DbOrTx } from "./types";

export interface ProfileInput {
  id: string;
  email: string;
  fullName?: string | null;
}

/**
 * Makes sure the profile mirror of an Auth user exists. Supabase creates it
 * with a trigger on auth.users; this covers the gap (trigger lag, the local
 * auth emulator) and keeps the email in sync.
 */
export async function ensureProfile(db: DbOrTx, input: ProfileInput): Promise<void> {
  const email = input.email.trim().toLowerCase();
  await db.profile.upsert({
    where: { id: input.id },
    update: { email, ...(input.fullName ? { fullName: input.fullName } : {}) },
    create: { id: input.id, email, fullName: input.fullName ?? null },
  });
}
