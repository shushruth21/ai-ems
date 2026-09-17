import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@ai-ems/ui/components/brand/logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr_auto] bg-background">
      <header className="px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Logo />
        </Link>
      </header>
      <main id="main" className="mx-auto grid w-full max-w-sm content-center px-4 py-8">
        {children}
      </main>
      <footer className="px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
        <Link href="/legal/terms" className="hover:text-foreground">
          Terms
        </Link>
        {" · "}
        <Link href="/legal/privacy" className="hover:text-foreground">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
