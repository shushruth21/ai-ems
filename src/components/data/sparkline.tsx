import { useId } from "react";

import { cn } from "@/lib/utils";

export interface SparklineProps {
  values: readonly number[];
  /** Accessible summary, e.g. "Revenue, last 12 weeks, trending up". */
  label: string;
  className?: string;
  width?: number;
  height?: number;
}

/** Builds an SVG path for a series scaled into the given box. Exported for tests. */
export function sparklinePath(
  values: readonly number[],
  width: number,
  height: number,
  pad = 2,
): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (height - pad * 2) * (1 - (v - min) / span);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/**
 * Trend line for stat tiles: history in the de-emphasis color, the current
 * point highlighted in the accent. Decorative detail — the value and delta
 * next to it carry the meaning, so the SVG is labelled, not narrated.
 */
export function Sparkline({ values, label, className, width = 96, height = 28 }: SparklineProps) {
  const titleId = useId();
  if (values.length < 2) return null;
  const path = sparklinePath(values, width, height);
  const last = path.split(" ").at(-1)?.slice(1).split(",").map(Number) ?? [0, 0];
  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
    >
      <title id={titleId}>{label}</title>
      <path
        d={path}
        fill="none"
        stroke="var(--color-chart-muted)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r={3}
        fill="var(--color-chart-1)"
        stroke="var(--color-surface)"
        strokeWidth={2}
      />
    </svg>
  );
}
