import { cn } from "@/lib/utils";

const SURFACES = [
  ["background", "bg-background"],
  ["surface", "bg-surface"],
  ["surface-raised", "bg-surface-raised"],
  ["surface-sunken", "bg-surface-sunken"],
  ["muted", "bg-muted"],
  ["accent", "bg-accent"],
  ["primary", "bg-primary"],
  ["sidebar", "bg-sidebar"],
] as const;

const STATUS = [
  ["neutral", "bg-neutral-bg border-neutral-border text-neutral"],
  ["info", "bg-info-bg border-info-border text-info"],
  ["success", "bg-success-bg border-success-border text-success"],
  ["warning", "bg-warning-bg border-warning-border text-warning"],
  ["danger", "bg-danger-bg border-danger-border text-danger"],
  ["ai", "bg-ai-bg border-ai-border text-ai"],
] as const;

const CHART = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"] as const;

const TYPE = [
  ["text-4xl", "Display"],
  ["text-2xl", "Page title"],
  ["text-lg", "Section title"],
  ["text-md", "Emphasis"],
  ["text-base", "Body — the default for interface text (14px)"],
  ["text-sm", "Dense data and secondary text (13px)"],
  ["text-xs", "Captions, labels and badges (12px)"],
] as const;

export function TokensGallery() {
  return (
    <div className="grid gap-6">
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Surfaces</h3>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SURFACES.map(([name, cls]) => (
            <li key={name} className="overflow-hidden rounded-md border">
              <div className={cn("h-12", cls)} />
              <p className="px-2 py-1.5 font-mono text-xs">{name}</p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Status tones</h3>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATUS.map(([name, cls]) => (
            <li key={name} className={cn("rounded-md border px-3 py-2 text-sm font-medium", cls)}>
              {name}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Chart series (fixed order)
        </h3>
        <ol className="flex flex-wrap gap-3">
          {CHART.map((cls, i) => (
            <li key={cls} className="flex items-center gap-2 text-sm">
              <span className={cn("size-4 rounded-xs", cls)} aria-hidden />
              Series {i + 1}
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">Type scale</h3>
        <ul className="space-y-2">
          {TYPE.map(([cls, sample]) => (
            <li key={cls} className="flex items-baseline gap-4">
              <code className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{cls}</code>
              <span className={cn(cls, cls.includes("xl") && "font-semibold tracking-tight")}>
                {sample}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
