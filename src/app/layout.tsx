import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";

import { AppProviders } from "@/components/providers/app-providers";
import { cn } from "@/lib/utils";
import { fontMono, fontSans } from "@/styles/fonts";

import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "AI EMS", template: "%s · AI EMS" },
  description:
    "AI-Powered Enterprise Management System — CRM, sales, inventory, procurement, production, quality and fulfillment in one platform.",
  applicationName: "AI EMS",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
    { media: "(prefers-color-scheme: dark)", color: "#15161b" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading request headers opts every page into dynamic rendering, which the
  // nonce-based CSP set in proxy.ts requires. Next.js applies the nonce to its
  // own scripts; we pass it to next-themes for its inline theme script.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={cn(fontSans.variable, fontMono.variable, "h-full")}
      suppressHydrationWarning
    >
      <body className="min-h-full">
        <AppProviders nonce={nonce}>{children}</AppProviders>
      </body>
    </html>
  );
}
