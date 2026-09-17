import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <LogoMark className="size-10" />
        <div className="grid size-12 place-items-center rounded-xl border bg-surface-sunken text-muted-foreground">
          <Compass className="size-6" aria-hidden />
        </div>
        <div className="space-y-2">
          <p className="font-mono text-sm text-muted-foreground">404</p>
          <h1 className="text-2xl font-semibold tracking-tight">We couldn&apos;t find that page</h1>
          <p className="text-base text-muted-foreground">
            The link may be outdated, or you may not have access to this workspace.
          </p>
        </div>
        <Button asChild>
          <Link href="/">Go to home</Link>
        </Button>
      </div>
    </main>
  );
}
