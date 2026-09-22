import type { Metadata } from "next";
import Link from "next/link";

import { SkipLink } from "@/components/layout/skip-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MAIN_CONTENT_ID } from "@/config/shell";
import { getSessionUser } from "@/server/auth/session";
import { Logo } from "@ai-ems/ui/components/brand/logo";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Minimal chrome for pages outside a workspace: account, onboarding, invitations. */
export default async function StandaloneLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser().catch(() => null);
  return (
    <div className="min-h-dvh bg-background">
      <SkipLink targetId={MAIN_CONTENT_ID} />
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-2 px-4 sm:px-6">
          <Link
            href={user ? "/app" : "/"}
            className="inline-flex rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={user ? "AI EMS — open your workspace" : "AI EMS home"}
          >
            <Logo />
          </Link>
          <nav aria-label="Account" className="ml-auto flex items-center gap-1 text-sm">
            {user ? (
              <>
                <Link
                  href="/app"
                  className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
                >
                  Workspace
                </Link>
                <Link
                  href="/account"
                  className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
                >
                  Account
                </Link>
              </>
            ) : null}
            <ThemeToggle />
          </nav>
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
