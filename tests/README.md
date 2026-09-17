# tests/ — cross-application suites

Package-owned tests live next to their code:

- unit tests: `packages/*/src/**/*.test.ts`
- component tests: `packages/ui/tests`, `apps/web/tests/component`
- database and RLS integration tests: `packages/db/tests/integration`

This folder holds suites that exercise the running system.

| Folder         | What                                                                                  | Run        |
| -------------- | ------------------------------------------------------------------------------------- | ---------- |
| `e2e/`         | User journeys, keyboard flows, responsive layout, axe (WCAG 2.2 AA) in light and dark | `make e2e` |
| `security/`    | Security headers, CSP, auth redirects, open-redirect protection                       | `make e2e` |
| `performance/` | Lighthouse budgets and k6 load profiles                                               | Phase 22   |

Browser suites run against a production build (`playwright.config.ts` starts one) with `ENABLE_UI_PREVIEW=true`.
