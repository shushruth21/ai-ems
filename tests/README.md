# tests/ — cross-application suites

Package-owned tests live next to their code:

- unit tests: `packages/*/src/**/*.test.ts`
- component tests: `packages/ui/tests`, `apps/web/tests/component`
- database and RLS integration tests: `packages/db/tests/integration`

This folder holds suites that exercise the running system.

| Folder         | What                                                                                                          | Run        |
| -------------- | ------------------------------------------------------------------------------------------------------------- | ---------- |
| `e2e/`         | User journeys (incl. every auth flow), keyboard flows, responsive layout, axe (WCAG 2.2 AA) in light and dark | `make e2e` |
| `security/`    | Security headers, CSP, auth redirects, open-redirect protection                                               | `make e2e` |
| `performance/` | Lighthouse budgets and k6 load profiles                                                                       | Phase 22   |

Browser suites run against a production build with `ENABLE_UI_PREVIEW=true`. `playwright.config.ts` starts two
servers: the Supabase Auth emulator (`tools/auth-emulator`, port 54321) and the app built against it. The app also
needs PostgreSQL with the auth tables (`E2E_DATABASE_URL`, see the CI `e2e` job). Tests create their own users
through the emulator's `/__users` hook, read "sent" emails from `/__emails`, and use a distinct
`x-forwarded-for` per test so rate limits don't collide.
