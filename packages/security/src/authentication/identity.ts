import { createHmac } from "node:crypto";

/**
 * Stable, non-reversible identity key for audit rows and rate-limit buckets so
 * raw email addresses aren't stored there. Keyed (HMAC) so the hash can't be
 * reversed with a dictionary of known emails without the server secret.
 */
export function hashIdentity(value: string, secret: string): string {
  if (secret.length < 16)
    throw new Error("hashIdentity requires a secret of at least 16 characters");
  return createHmac("sha256", secret).update(value.trim().toLowerCase()).digest("hex");
}
