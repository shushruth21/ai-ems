import { authenticateApiKey, apiJson } from "@/server/api/key-auth";
import { prisma } from "@ai-ems/db/client";

export const dynamic = "force-dynamic";

/** GET /api/v1/workspace — the workspace the presented key belongs to. */
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "read");
  if ("response" in auth) return auth.response;

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: auth.ctx.organizationId },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      currency: true,
      timezone: true,
      createdAt: true,
    },
  });
  return apiJson({
    data: { ...organization, createdAt: organization.createdAt.toISOString() },
    scopes: auth.ctx.key.scopes,
  });
}
