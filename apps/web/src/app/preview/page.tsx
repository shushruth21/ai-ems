import { notFound, redirect } from "next/navigation";

import { isPreviewEnabled } from "@/lib/routes";

export default function PreviewIndex() {
  if (!isPreviewEnabled()) notFound();
  redirect("/preview/demo/dashboard");
}
