import type { AuthEventType, Prisma } from "../generated/prisma/client";

export type { AuthEventType };

export interface AuthEventInput {
  type: AuthEventType;
  profileId?: string | null;
  identityHash?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AuthEventView {
  id: string;
  type: AuthEventType;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

/** The slice of PrismaClient these functions need (easy to fake in tests). */
export interface AuthEventDb {
  authEvent: {
    create(args: { data: Prisma.AuthEventUncheckedCreateInput }): Promise<unknown>;
    findMany(args: {
      where: Prisma.AuthEventWhereInput;
      orderBy: Prisma.AuthEventOrderByWithRelationInput;
      take: number;
      select: { id: true; type: true; ip: true; userAgent: true; createdAt: true };
    }): Promise<
      Array<{
        id: bigint;
        type: AuthEventType;
        ip: string | null;
        userAgent: string | null;
        createdAt: Date;
      }>
    >;
  };
}

const MAX_USER_AGENT = 512;

export async function recordAuthEvent(db: AuthEventDb, input: AuthEventInput): Promise<void> {
  await db.authEvent.create({
    data: {
      type: input.type,
      profileId: input.profileId ?? null,
      identityHash: input.identityHash ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ? input.userAgent.slice(0, MAX_USER_AGENT) : null,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}

export async function listRecentAuthEvents(
  db: AuthEventDb,
  profileId: string,
  limit = 20,
): Promise<AuthEventView[]> {
  const rows = await db.authEvent.findMany({
    where: { profileId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    select: { id: true, type: true, ip: true, userAgent: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, id: r.id.toString() }));
}
