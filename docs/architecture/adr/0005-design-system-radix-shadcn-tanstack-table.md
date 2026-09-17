# 0005. Design system on Radix (shadcn pattern) and TanStack Table v9

- **Status:** accepted
- **Date:** 2026-09-17

## Decision

- Primitives live in `@ai-ems/ui` and follow the shadcn pattern: Radix, `cva` and `data-slot`, with semantic tokens only.
- Tables use TanStack Table **v9**, with an explicit shared `dataTableFeatures`.
- Chart colors are a fixed categorical order that passes the palette validator in both themes.
- Motion uses Framer Motion `LazyMotion` and respects reduced-motion preferences.

## Consequences

- Accessibility comes built in. axe runs in CI, in light and dark mode.
- We own the component code, and the shadcn CLI remains usable.
- v9 is newer and less documented. The package-shipped agent skills are the reference.
