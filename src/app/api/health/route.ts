import { NextResponse } from "next/server";

import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

/**
 * Liveness: GET /api/health
 * Readiness (checks the database): GET /api/health?deep=1
 */
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const body: Record<string, unknown> = {
    status: "ok",
    service: "ai-ems",
    version: packageJson.version,
    time: new Date().toISOString(),
  };

  if (deep) {
    try {
      const { prisma } = await import("@/server/db/prisma");
      await prisma.$queryRaw`select 1`;
      body.database = "ok";
    } catch {
      body.status = "degraded";
      body.database = "unreachable";
      return NextResponse.json(body, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
