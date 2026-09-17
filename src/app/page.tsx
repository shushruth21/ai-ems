import Image from "next/image";

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

/** Temporary foundation page — replaced by the marketing site and app shell in Phase 2. */
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
          AI-Powered Enterprise Management System. Foundation build — the workspace, modules and
          copilot are delivered in the upcoming phases.
        </p>
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
