import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";

import "./globals.css";

// Self-hosted variable fonts (SIL OFL 1.1) — no third-party requests, CSP-friendly.
const inter = localFont({
  src: "./fonts/inter-latin-var.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});
const jetbrains = localFont({
  src: "./fonts/jetbrains-mono-latin-var.woff2",
  variable: "--font-jetbrains",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "AI EMS", template: "%s · AI EMS" },
  description:
    "AI-Powered Enterprise Management System — CRM, sales, inventory, procurement, production, quality and fulfillment in one platform.",
  applicationName: "AI EMS",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfe" },
    { media: "(prefers-color-scheme: dark)", color: "#16161f" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading request headers opts every page into dynamic rendering, which the
  // nonce-based CSP set in proxy.ts requires (Next.js applies the nonce to its
  // own scripts automatically). Read `x-nonce` here for any third-party <Script>.
  await headers();
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
