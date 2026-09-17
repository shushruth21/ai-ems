import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { SIDEBAR_COOKIE } from "@/config/shell";
import { PreviewBanner } from "@/features/preview/components/preview-banner";
import { previewShellContext } from "@/features/preview/sample-data";
import { isPreviewEnabled } from "@/lib/routes";

export const metadata: Metadata = {
  title: { default: "Preview", template: "%s · Preview · AI EMS" },
  robots: { index: false, follow: false },
};

/**
 * UI sandbox: renders the real AppShell with sample identity and data.
 * Phases 3–4 mount the same shell at /[org] with server-resolved context.
 */
export default async function PreviewLayout({ children, params }: LayoutProps<"/preview/[org]">) {
  if (!isPreviewEnabled()) notFound();
  const { org } = await params;
  const context = previewShellContext(org);
  if (!context) notFound();
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";

  return (
    <AppShell {...context} defaultCollapsed={collapsed}>
      <PreviewBanner basePath={context.basePath} />
      {children}
    </AppShell>
  );
}
