import { redirect } from "next/navigation";

import { getOrgContext } from "@/server/org/context";

/** `/<org>` is the workspace home; the dashboard owns the content. */
export default async function OrgIndex({ params }: PageProps<"/[org]">) {
  const { org } = await params;
  await getOrgContext(org);
  redirect(`/${org}/dashboard`);
}
