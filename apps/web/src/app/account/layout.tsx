import type { Metadata } from "next";
import Link from "next/link";

import { SkipLink } from "@/components/layout/skip-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MAIN_CONTENT_ID } from "@/config/shell";
import { Logo } from "@ai-ems/ui/components/brand/logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Minimal chrome for personal settings until organizations arrive (Phase 4). */
export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="min-h-dvh bg-background">
      <SkipLink targetId={MAIN_CONTENT_ID} />
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo />
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className="mx-auto max-w-4xl px-4 py-8 outline-none sm:px-6"
      >
        {children}
      </main>
    </div>
  );
}
