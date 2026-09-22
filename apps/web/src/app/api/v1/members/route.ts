import { authenticateApiKey, apiJson } from "@/server/api/key-auth";
import { prisma } from "@ai-ems/db/client";
import { listMembers } from "@ai-ems/db/platform/members";

export const dynamic = "force-dynamic";

/** GET /api/v1/members — active and suspended members of the key's workspace. */
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request, "read");
  if ("response" in auth) return auth.response;

  const members = await listMembers(prisma, auth.ctx.organizationId);
  return apiJson({
    data: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.roleKey,
      status: m.status,
      joinedAt: m.joinedAt.toISOString(),
    })),
  });
}
