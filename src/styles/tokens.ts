/**
 * Design tokens needed in TypeScript (motion, breakpoints, layout).
 * Colors live in CSS variables (src/styles/globals.css) so themes switch
 * without re-rendering; read them via `var(--token)` when needed.
 */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/** Seconds, for Framer Motion. Mirrors --duration-* in CSS. */
export const duration = {
  fast: 0.12,
  base: 0.18,
  slow: 0.26,
} as const;

export const easing = {
  out: [0.2, 0.8, 0.2, 1],
  inOut: [0.65, 0, 0.35, 1],
} as const;

export const transitions = {
  base: { duration: duration.base, ease: easing.out },
  slow: { duration: duration.slow, ease: easing.out },
} as const;

export const layout = {
  sidebarWidth: 240,
  sidebarCollapsedWidth: 52,
  topbarHeight: 52,
} as const;

/** Chart series colors (CSS variable references), in categorical order. */
export const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;
