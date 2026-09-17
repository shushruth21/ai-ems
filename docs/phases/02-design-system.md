# Phase 2 — Design System & App Shell

> **Note:** file paths in this record predate the monorepo restructure (Phase 2.5). See [02b-monorepo-restructure.md](02b-monorepo-restructure.md) for the path mapping.

**Status:** complete, waiting for approval before Phase 3 (Authentication).
**Builds on:** Phase 1 foundation (`13eda4a`). Nothing from Phase 1 was redesigned. The only changes to existing files are listed in §3.

## 1. Architecture

The shell is **data-agnostic**. `AppShell` takes four inputs: a `user`, an `organization`, a list of `permissions`, and a `basePath`. It never fetches them itself. This keeps it independent of the phase order:

| Phase       | What mounts the shell                                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2 (now)** | `/preview/[org]` renders it with fictional sample context. The preview route is on in development and returns 404 in production unless `ENABLE_UI_PREVIEW=true`. |
| **3–4**     | `/[org]` renders it with context resolved on the server (session → membership → role → permissions). No shell changes needed.                                    |

```
RootLayout (server) ── reads x-nonce ──▶ AppProviders (client)
   ThemeProvider(nonce) › QueryProvider › MotionProvider(LazyMotion + reducedMotion) › TooltipProvider › Toaster
      └─ preview/[org]/layout (server): flag check → sample context → sidebar cookie
            └─ AppShell (client)
                 ShellProvider  (permissions → filtered NAVIGATION, sidebar/palette/help state)
                 ├─ SkipLink
                 ├─ AppSidebar   desktop: sticky rail, collapsible (cookie) · mobile: Sheet drawer
                 │    OrgSwitcher · SidebarNav (aria-current, tooltips when collapsed)
                 ├─ Topbar       mobile menu · AppBreadcrumbs · ⌘K trigger · Ask AI · Notifications · ThemeToggle · UserMenu
                 ├─ <main id="main-content">  page (PageContainer › PageHeader › content)
                 ├─ CommandPalette  (navigation, permission-filtered "Create" actions, preferences)
                 ├─ ShortcutsDialog
                 └─ GlobalHotkeys   (mod+k, /, [, ?, g-sequences)
```

### Design decisions

| Decision         | Choice                                                                                                                             | Why                                                                                                                                                                                                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component source | shadcn-style components (Radix + `cva` + `data-slot`), written by hand, with `components.json` included                            | The shadcn registry is blocked from the build sandbox. The shadcn CLI still works on your machine.                                                                                                                                                                                                           |
| Token layers     | Primitives → semantic CSS variables → Tailwind `@theme inline` → components                                                        | Themes switch without re-rendering, and components never use raw colors.                                                                                                                                                                                                                                     |
| Chart palette    | 5 categorical slots in fixed order, **run through the data-viz palette validator** in both modes                                   | My first palette failed the colorblind check (red and green were indistinguishable under deuteranopia). The shipped palette passes lightness, chroma, CVD ΔE ≥ 8 and normal-vision ΔE ≥ 15. Light-mode slots 3–5 are below 3:1 contrast, so every future chart must also show direct labels or a table view. |
| Type scale       | 14px body, 13px dense data, 12px minimum, no half-pixel sizes                                                                      | Dense but readable.                                                                                                                                                                                                                                                                                          |
| Data table       | TanStack Table **v9** (`useTable` + explicit `tableFeatures`), with a shared `dataTableFeatures` and `createDataTableColumns<T>()` | Current major version. Only the features the table actually uses get bundled.                                                                                                                                                                                                                                |
| Motion           | `LazyMotion(domAnimation)` + `m.*`, `MotionConfig reducedMotion="user"`, CSS `prefers-reduced-motion` guard                        | Small bundle, and reduced-motion settings are honored everywhere.                                                                                                                                                                                                                                            |
| Sidebar state    | Cookie (`aiems-sidebar`), read by the server layout                                                                                | No layout flash on load, and the collapsed state survives reloads.                                                                                                                                                                                                                                           |
| Shortcuts        | Pure parser in `lib/hotkeys.ts`, plus one `useHotkeys` hook                                                                        | Unit-testable. Ignored while typing (except `mod+` chords).                                                                                                                                                                                                                                                  |
| Theme script     | The `next-themes` inline script receives the CSP nonce                                                                             | Keeps the strict nonce-based CSP from Phase 1 working.                                                                                                                                                                                                                                                       |
| Shared constants | `src/config/shell.ts` has no `"use client"`                                                                                        | See §12, lesson 1.                                                                                                                                                                                                                                                                                           |

## 2. Folder structure (added in this phase)

```
components.json
src/
├── app/
│   ├── layout.tsx                 providers + nonce (updated)
│   ├── not-found.tsx · error.tsx · global-error.tsx
│   └── preview/
│       ├── page.tsx               → /preview/demo/dashboard
│       └── [org]/
│           ├── layout.tsx         flag gate, sample context, AppShell
│           ├── loading.tsx
│           ├── dashboard/page.tsx
│           ├── sales/orders/page.tsx
│           ├── design-system/page.tsx
│           └── [...slug]/page.tsx "Arrives in Phase N"
├── components/
│   ├── brand/logo.tsx
│   ├── providers/  app-providers · theme-provider · query-provider · motion-provider
│   ├── ui/         32 base components (see §5)
│   ├── data/       page-header · empty-state · status-badge · kpi-card · sparkline
│   │               data-table/{data-table, toolbar, pagination, sortable-header, index}
│   └── layout/     app-shell · shell-context · app-sidebar · sidebar-nav · org-switcher
│                   topbar · app-breadcrumbs · command-palette · shortcuts-dialog
│                   global-hotkeys · notifications-button · theme-toggle · user-menu
│                   skip-link · page-container
├── config/         navigation.ts · quick-actions.ts · shell.ts
├── features/preview/  sample-data.ts · roadmap.ts · components/{preview-banner, orders-table, gallery/*}
├── hooks/          use-hotkeys · use-media-query · use-platform
├── lib/            format.ts · status.ts · hotkeys.ts   (+ routes.ts: preview flag)
├── styles/         globals.css (moved from app/) · tokens.ts · fonts.ts · fonts/ (moved)
└── types/          shell.ts
tests/
├── setup.ts        jsdom polyfills for Radix/cmdk
├── utils/          render-shell.tsx · next-navigation.ts
├── component/      ui-primitives · data-table · app-shell · sample-form
└── e2e/shell.spec.ts
```

## 3. Database changes

**None.** This phase is UI only.

Changes to existing files:

| File                                             | Change                                    |
| ------------------------------------------------ | ----------------------------------------- |
| `src/app/layout.tsx`                             | Adds providers and passes the nonce       |
| `src/app/globals.css` → `src/styles/globals.css` | Moved and expanded                        |
| `src/app/fonts/` → `src/styles/fonts/`           | Moved                                     |
| `src/lib/routes.ts`                              | Adds the `isPreviewEnabled` flag          |
| `src/lib/env.ts`                                 | Adds `ENABLE_UI_PREVIEW`                  |
| `tsconfig.json`                                  | Unchanged                                 |
| `package.json`                                   | `typecheck` now runs `next typegen` first |
| `.prettierrc.json`                               | Stylesheet path updated                   |
| `playwright.config.ts`                           | Preview flag enabled for the test server  |
| `vitest.config.mts`                              | Includes component tests                  |
| `.env.example`                                   | Documents the new flag                    |

## 4. API design

No new HTTP endpoints. The shell's input contract is its "API":

```ts
interface ShellContextValue {
  user: { id; name; email; avatarUrl?; title? };
  organization: { id; slug; name; plan; logoUrl? };
  organizations: ShellOrganization[];
  permissions: readonly Permission[]; // from the Phase 1 catalog
  basePath: string; // "/acme" (Phase 4) or "/preview/demo"
  preview?: boolean; // disables session-only actions
}
```

Navigation contract: `NavItem { id, title, href, icon, permission?, keywords?, shortcut? }`. Items are hidden unless `permission` is in the set.

## 5. Components

- **UI (32):**
  - Actions: `button` (8 variants, 7 sizes, `loading`, `asChild`), `badge` (8 tones, dot)
  - Form controls: `input`, `textarea`, `label`, `checkbox` (indeterminate), `switch`, `select`, `radio-group`
  - Layout: `separator`, `card` (header/title/description/action/content/footer), `scroll-area`, `collapsible`, `toggle-group`
  - Overlays: `tooltip` (+ `SimpleTooltip`), `popover`, `dropdown-menu` (checkbox/radio/sub/danger), `dialog`, `alert-dialog`, `sheet` (left/right/bottom)
  - Navigation and structure: `tabs` (underline/segmented), `table` (density + inset), `command`, `breadcrumb`
  - Feedback: `skeleton`, `spinner`, `alert` (6 tones), `progress` (4 tones), `sonner` toasts
  - Other: `avatar` (+ `initialsOf`), `kbd`, `form` (RHF bindings with automatic aria wiring)
- **Data:**
  - `DataTable`: global search, sorting with `aria-sort`, pagination and page size, row selection with bulk actions, column visibility, density toggle, loading skeletons, empty and no-results states, keyboard-activatable rows
  - `KpiCard`: value, signed delta colored by whether "up is good", sparkline, loading state
  - `StatusBadge`: one status-to-color map for every Prisma workflow enum
  - `PageHeader`, `EmptyState`, `Sparkline`
- **Layout:** as shown in §1.

## 6. Server actions

**None this phase.** The shell's only persistence is the sidebar cookie. The first server actions arrive with login in Phase 3.

## 7. Prisma models

**Unchanged** (52 models). `StatusBadge` is tested against the generated Prisma enums, so a new workflow status without a color fails CI.

## 8. UI

| Route                         | Contents                                                                                                                                                                                                                                                         |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/preview/demo/dashboard`     | 4 stat tiles (one with a sparkline), recent-orders table, an AI daily brief card (labelled _Sample_, its actions disabled, with the note "AI suggestions never change data without your approval"), and work-center load bars (color + label, never color alone) |
| `/preview/demo/sales/orders`  | 64 deterministic sample orders in the full DataTable, a bulk "Export" action (toast only), and a detail drawer on row click                                                                                                                                      |
| `/preview/demo/design-system` | Tokens (surfaces, status, chart series, type scale), buttons and badges, overlays, a validated form, feedback, tabs                                                                                                                                              |
| `/preview/demo/<module>`      | "Arrives in Phase N" placeholder for each planned module                                                                                                                                                                                                         |
| `/preview/harborline/…`       | A second sample org to exercise the org switcher                                                                                                                                                                                                                 |

**Keyboard shortcuts:**

| Keys            | Action          |
| --------------- | --------------- |
| `⌘K` / `Ctrl K` | Command palette |
| `/`             | Search          |
| `[`             | Toggle sidebar  |
| `?`             | Shortcut help   |
| `g h`           | Dashboard       |
| `g t`           | Tasks           |
| `g l`           | Leads           |
| `g q`           | Quotes          |
| `g o`           | Orders          |
| `g w`           | Work orders     |
| `g i`           | Inventory       |
| `g p`           | Purchasing      |
| `g s`           | Settings        |

All sample names are invented. The second org's slug was renamed from an early draft that echoed a well-known Microsoft sample database.

## 9. Validation

- `leadFormSchema` (Zod 4) demonstrates the house pattern:
  - `z.input` / `z.output` types with the resolver
  - `z.coerce.number<string>()` for numeric inputs
  - `refine` for required consent
  - `mode: "onTouched"`
- `FormControl` sets `aria-invalid` and links the description and error text through `aria-describedby`. `FormMessage` uses `role="alert"`.
- `FormField` forwards React Hook Form's third generic (transformed values), which I fixed during this phase.

## 10. Tests

| Suite                              | Count                                        | Covers                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                               | 18 files, 113 tests total (unit + component) | navigation (unique ids and shortcuts, permission filter, longest-prefix active item, breadcrumbs), hotkeys (chords per platform, sequences, timeouts, editable targets), formatters (currency, compact, percent, delta, dates, relative time), status tones vs **every Prisma workflow enum**, sample-data determinism, roadmap, preview flag, plus all 47 Phase 1 tests      |
| Component (jsdom)                  | 4 files                                      | Button states; KpiCard sentiment; DataTable pagination, sorting, search, selection, bulk actions, row keyboard activation, loading/empty states, column visibility; AppShell landmarks, permission-filtered nav, cookie collapse, ⌘K navigation, permission-filtered actions, g-sequences, ignoring shortcuts while typing, mobile drawer; form error wiring and valid submit |
| E2E (Playwright, desktop + mobile) | 33 passed, 7 device-specific skips           | Every preview page: no console or CSP errors, **axe WCAG 2.2 AA with zero serious issues in light and dark**, no horizontal overflow. Also: redirect and 404, palette navigation, g-sequence + help, sidebar persistence across reload, theme persistence, table search → select → bulk → drawer, form validation, mobile drawer. Plus the Phase 1 smoke suite.               |

**Bugs the tests caught and I fixed before delivery:**

1. **Chart palette failed the colorblind check** (validator).
2. **`PARTIALLY_ACCEPTED` had no status color** (enum coverage test).
3. **Two buttons shared the name "Clear search"** (component test).
4. **The mobile "New order" and "Columns" buttons had no accessible name** (axe).
5. **Segmented tabs referenced missing panels** (axe).
6. **Horizontally scrolling tables weren't keyboard-focusable** (axe). The container is now a labelled, focusable region.
7. **The dashboard scrolled sideways on phones.** Grid items grew to fit the table's width. Found by screenshot review, now guarded by the overflow test.
8. **The sidebar collapse didn't survive a reload** (e2e). See lesson 1 below.
9. **The command palette ranked "New sales order" above the Sales orders page** for the query "sales orders". Navigation now comes first.

## 11. Commands

```bash
npm install
npm run dev                          # http://localhost:3000/preview (preview on by default in dev)
npm run check                        # typegen + tsc + eslint + prettier + vitest
npm run build
ENABLE_UI_PREVIEW=true npm run test:e2e
# Sandbox without matching browser builds:
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

## 12. Verification checklist

- [x] `next typegen && tsc --noEmit`: 0 errors, strict, no `any`
- [x] `eslint --max-warnings=0`: clean, no disable comments in app code
- [x] `prettier --check`: clean
- [x] Vitest: **113/113**
- [x] `next build`: succeeds. All preview routes are dynamic, which the nonce CSP requires.
- [x] Playwright: **33/33** (desktop + mobile), axe clean in light and dark
- [x] Screenshots reviewed: light, dark, collapsed rail, command palette, bulk selection, design system (both themes), mobile page and drawer
- [x] Chart palette validated in both modes
- [x] No reference-app code, branding, colors, icons or data. Lucide icons (ISC license) and original SVG mark.
- [x] `npm audit`: 0 vulnerabilities
- [ ] Visual check on your machine (`npm run dev` → `/preview`)

**Lessons and notes:**

1. **Never import values from a `"use client"` module into a Server Component.** The value becomes a client reference, not the value itself. Shared constants live in `src/config/*.ts` without the directive.
2. **Streaming status codes:** `notFound()` inside a page under an already-streaming layout renders the 404 UI (with `noindex`) but keeps HTTP 200. That's normal Next.js behavior. Unknown orgs return a real 404 because the layout checks first.
3. **`next start` warning:** Next prints a warning with `output: "standalone"`. It still serves correctly. Production Docker uses `node server.js` (Phase 1 Dockerfile).
4. **Chart rule:** any future chart must render direct labels or offer a table view (light-mode contrast of slots 3–5).

## Next: Phase 3 (Authentication), for approval

- Supabase Auth pages: sign in (password + magic link), sign up, verify email, forgot and reset password, OAuth (Google, Microsoft) callback, sign out.
- MFA (TOTP) enrolment and challenge.
- Session-aware `proxy.ts` redirects (already scaffolded) and a server `getSession()` helper.
- Rate limiting on auth endpoints, plus audit events for sign-in, sign-out and password changes.
- The shell's user menu becomes live (sign out). The org context still uses a temporary single-org resolver until Phase 4.
