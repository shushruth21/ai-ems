import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { recordAudit } from "./audit";
import { PlatformError, type Db, type DbOrTx, type Tx } from "./types";

/**
 * Tenant API keys. The secret is shown once; only its SHA-256 is stored, with
 * a public prefix so a key can be recognised in a list or a log line.
 */
export const API_KEY_PREFIX = "aiems";
export const MAX_ACTIVE_API_KEYS = 20;

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

const select = {
  id: true,
  name: true,
  prefix: true,
  scopes: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const;

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * `aiems_<12 hex prefix>_<43-char secret>`. The prefix is hex on purpose: the
 * base64url secret may itself contain `_`, so the token can't be split on it.
 */
export function newApiKey(): { token: string; prefix: string; keyHash: string } {
  const prefix = randomBytes(6).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const token = `${API_KEY_PREFIX}_${prefix}_${secret}`;
  return { token, prefix, keyHash: hashApiKey(token) };
}

const TOKEN_PATTERN = new RegExp(`^${API_KEY_PREFIX}_([0-9a-f]{12})_([A-Za-z0-9_-]{20,})$`);

export function parseApiKey(token: string): { prefix: string } | null {
  const match = TOKEN_PATTERN.exec(token);
  return match ? { prefix: match[1]! } : null;
}

export async function listApiKeys(db: DbOrTx, organizationId: string): Promise<ApiKeyRow[]> {
  return db.apiKey.findMany({
    where: { organizationId },
    orderBy: [{ revokedAt: "asc" }, { createdAt: "desc" }],
    select,
  });
}

export interface ApiKeyActor {
  organizationId: string;
  actorProfileId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export async function createApiKey(
  db: Db,
  actor: ApiKeyActor,
  input: { name: string; scopes: string[]; expiresInDays?: number },
): Promise<{ id: string; token: string; prefix: string; expiresAt: Date | null }> {
  return db.$transaction(async (tx: Tx) => {
    const active = await tx.apiKey.count({
      where: { organizationId: actor.organizationId, revokedAt: null },
    });
    if (active >= MAX_ACTIVE_API_KEYS) {
      throw new PlatformError(
        "limit_reached",
        `A workspace can have ${MAX_ACTIVE_API_KEYS} active keys.`,
      );
    }
    const { token, prefix, keyHash } = newApiKey();
    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    const key = await tx.apiKey.create({
      data: {
        organizationId: actor.organizationId,
        name: input.name,
        prefix,
        keyHash,
        scopes: input.scopes,
        expiresAt,
        createdById: actor.actorProfileId,
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.actorProfileId,
      action: "api_key.created",
      entityType: "api_key",
      entityId: key.id,
      changes: {
        name: input.name,
        prefix,
        scopes: input.scopes,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
    return { id: key.id, token, prefix, expiresAt };
  });
}

export async function revokeApiKey(db: Db, actor: ApiKeyActor, apiKeyId: string): Promise<void> {
  await db.$transaction(async (tx: Tx) => {
    const { count } = await tx.apiKey.updateMany({
      where: { id: apiKeyId, organizationId: actor.organizationId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) throw new PlatformError("not_found", "Key not found or already revoked.");
    await recordAudit(tx, {
      organizationId: actor.organizationId,
      actorId: actor.actorProfileId,
      action: "api_key.revoked",
      entityType: "api_key",
      entityId: apiKeyId,
      ip: actor.ip,
      userAgent: actor.userAgent,
    });
  });
}

export interface VerifiedApiKey {
  id: string;
  organizationId: string;
  scopes: string[];
}

/**
 * Verifies a presented key. Looks the row up by its public prefix, then
 * compares hashes in constant time. Revoked and expired keys are rejected.
 * `lastUsedAt` is updated at most once a minute to avoid a write per request.
 */
export async function verifyApiKey(db: Db, token: string): Promise<VerifiedApiKey | null> {
  const parsed = parseApiKey(token);
  if (!parsed) return null;
  const key = await db.apiKey.findUnique({
    where: { prefix: parsed.prefix },
    select: {
      id: true,
      organizationId: true,
      keyHash: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
      lastUsedAt: true,
      organization: { select: { archivedAt: true } },
    },
  });
  if (!key || key.revokedAt || key.organization.archivedAt) return null;
  if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) return null;

  const presented = Buffer.from(hashApiKey(token));
  const stored = Buffer.from(key.keyHash);
  if (presented.length !== stored.length || !timingSafeEqual(presented, stored)) return null;

  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) {
    await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  }
  return { id: key.id, organizationId: key.organizationId, scopes: key.scopes };
}
