import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { formatDelta } from "../../lib/format";
import { cn } from "../../lib/utils";

import { Sparkline } from "./sparkline";

export type DeltaSentiment = "positive" | "negative" | "neutral";

/** Direction × whether "up" is good for this metric → sentiment. */
export function deltaSentiment(delta: number, upIsGood = true): DeltaSentiment {
  if (!Number.isFinite(delta) || delta === 0) return "neutral";
  return delta > 0 === upIsGood ? "positive" : "negative";
}

export interface KpiCardProps {
  label: string;
  /** Pre-formatted value (use formatCompact / formatCurrency). */
  value: ReactNode;
  /** Fractional change, e.g. 0.124 for +12.4%. */
  delta?: number;
  /** Period the delta compares against, e.g. "vs last month". */
  deltaLabel?: string;
  upIsGood?: boolean;
  trend?: readonly number[];
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
}

const sentimentClass: Record<DeltaSentiment, string> = {
  positive: "text-success",
  negative: "text-danger",
  neutral: "text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  upIsGood = true,
  trend,
  hint,
  loading = false,
  className,
}: KpiCardProps) {
  if (loading) {
    return (
      <Card className={cn("gap-3 p-4", className)} aria-busy>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-3.5 w-20" />
      </Card>
    );
  }
  const sentiment = delta === undefined ? "neutral" : deltaSentiment(delta, upIsGood);
  const DeltaIcon =
    delta === undefined || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <Card data-slot="kpi-card" className={cn("gap-2 p-4", className)}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {trend && trend.length > 1 ? (
          <Sparkline values={trend} label={`${label} trend`} className="mb-1 shrink-0" />
        ) : null}
      </div>
      {delta !== undefined || hint ? (
        <p className="flex items-center gap-1.5 text-sm">
          {delta !== undefined ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                sentimentClass[sentiment],
              )}
            >
              <DeltaIcon className="size-3.5" aria-hidden />
              {formatDelta(delta)}
            </span>
          ) : null}
          {deltaLabel ? <span className="text-muted-foreground">{deltaLabel}</span> : null}
          {hint ? <span className="text-muted-foreground">{hint}</span> : null}
        </p>
      ) : null}
    </Card>
  );
}
