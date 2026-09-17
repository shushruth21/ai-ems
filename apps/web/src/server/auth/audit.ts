import "server-only";

import { authSettings, type ServerEnv } from "@ai-ems/config/env";
import { env } from "@ai-ems/config/env.server";
import type { AuthEventInput, AuthEventType } from "@ai-ems/db/auth/auth-events";
import { logger } from "@ai-ems/observability/logger";
import { hashIdentity } from "@ai-ems/security/authentication/identity";

import { getRequestMeta } from "./request-meta";

export function identityKey(email: string, e: ServerEnv = env()): string {
  return hashIdentity(email, authSettings(e).identitySecret);
}

/**
 * Records a security event. Never throws: an audit outage must not block
 * sign-in, but it is logged loudly so it can be alerted on.
 */
export async function auditAuthEvent(
  type: AuthEventType,
  details: {
    profileId?: string | null;
    email?: string | null;
    metadata?: AuthEventInput["metadata"];
  } = {},
): Promise<void> {
  try {
    const [{ prisma }, { recordAuthEvent }, meta] = await Promise.all([
      import("@ai-ems/db/client"),
      import("@ai-ems/db/auth/auth-events"),
      getRequestMeta(),
    ]);
    await recordAuthEvent(prisma, {
      type,
      profileId: details.profileId ?? null,
      identityHash: details.email ? identityKey(details.email) : null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: details.metadata,
    });
  } catch (error) {
    logger.error("auth.audit_failed", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
