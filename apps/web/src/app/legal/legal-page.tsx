import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@ai-ems/ui/components/brand/logo";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto grid max-w-2xl gap-6 px-4 py-10">
      <Link href="/" className="inline-flex w-fit rounded-md">
        <Logo />
      </Link>
      <main id="main" className="grid gap-4 text-base leading-relaxed">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}
