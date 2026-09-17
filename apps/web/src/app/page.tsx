import Image from "next/image";
import Link from "next/link";

import { Button } from "@ai-ems/ui/components/ui/button";

const modules = [
  "CRM",
  "Catalog & Configurator",
  "Sales",
  "Inventory",
  "Procurement",
  "Production",
  "Quality",
  "Fulfillment",
  "Finance",
  "AI Copilot",
];

/** Temporary landing page — replaced by the marketing site in a later phase. */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-6 py-16">
      <div className="flex items-center gap-3">
        <Image src="/icon.svg" alt="" width={40} height={40} priority />
        <span className="text-xl font-semibold tracking-tight">AI EMS</span>
      </div>
      <div className="space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          One platform from first lead to final delivery.
        </h1>
        <p className="max-w-xl text-lg text-pretty text-muted-foreground">
          AI-Powered Enterprise Management System. Accounts and security are live; the workspace,
          modules and copilot arrive in the upcoming phases.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/signup">Create account</Link>
        </Button>
      </div>
      <ul className="flex flex-wrap gap-2" aria-label="Planned modules">
        {modules.map((m) => (
          <li
            key={m}
            className="bg-card rounded-full border border-border px-3 py-1 text-sm text-muted-foreground"
          >
            {m}
          </li>
        ))}
      </ul>
    </main>
  );
}
