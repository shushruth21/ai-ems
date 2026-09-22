import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@ai-ems/db/client";
import { verifyApiKey, type VerifiedApiKey } from "@ai-ems/db/platform/api-keys";
import { logger } from "@ai-ems/observability/logger";

/**
 * Bearer-token authentication for `/api/v1`. Keys are workspace-scoped, so a
 * request never names the organization it wants: it gets the one the key
 * belongs to. Failures are deliberately uniform — a caller can't tell an
 * unknown key from a revoked or expired one.
 */
export interface ApiContext {
  key: VerifiedApiKey;
  organizationId: string;
}

const UNAUTHORIZED = { error: "unauthorized", message: "Provide a valid API key." };

export function apiError(status: number, error: string, message: string): NextResponse {
  return NextResponse.json({ error, message }, { status, headers: noStore });
}

const noStore = { "Cache-Control": "no-store" } as const;

export function apiJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: noStore });
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, ...rest] = header.split(" ");
  const token = rest.join(" ").trim();
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

/**
 * Resolves the calling key, or returns the response to send. `scope` is the
 * capability the endpoint needs ("read" for GETs, "write" for changes).
 */
export async function authenticateApiKey(
  request: Request,
  scope: "read" | "write",
): Promise<{ ctx: ApiContext } | { response: NextResponse }> {
  const token = bearer(request);
  if (!token) {
    return {
      response: NextResponse.json(UNAUTHORIZED, {
        status: 401,
        headers: { ...noStore, "WWW-Authenticate": 'Bearer realm="ai-ems"' },
      }),
    };
  }
  const key = await verifyApiKey(prisma, token);
  if (!key) {
    return { response: NextResponse.json(UNAUTHORIZED, { status: 401, headers: noStore }) };
  }
  if (!key.scopes.includes(scope)) {
    logger.warn("api.scope_denied", { keyId: key.id, scope });
    return {
      response: apiError(403, "forbidden", `This key has no ${scope} scope.`),
    };
  }
  return { ctx: { key, organizationId: key.organizationId } };
}
