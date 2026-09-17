import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";
import { env } from "@ai-ems/config/env.server";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const { DATABASE_URL, NODE_ENV } = env();
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: DATABASE_URL }),
    log: NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Root Prisma client. **Not tenant-scoped** — application code should use
 * `getTenantDb(orgId)` from ./tenant instead. Reserved for platform services
 * (sign-up, membership lookup, background workers).
 */
export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
