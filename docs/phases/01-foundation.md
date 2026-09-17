# Phase 1 — Foundation

> **Note:** file paths in this record predate the monorepo restructure (Phase 2.5). See [02b-monorepo-restructure.md](02b-monorepo-restructure.md) for the path mapping.

**Status:** complete, waiting for approval before Phase 2 (design system and app shell).

## 1. Explanation

Phase 1 builds the base the rest of the product needs:

- A strict TypeScript Next.js 16 project with its quality tooling.
- A normalized multi-tenant database schema.
- Tenant isolation in two layers: the server-side Prisma scope and Postgres RLS.
- A permission-based authorization model.
- Security headers and a nonce-based CSP.
- Tested pure business logic: money, pricing, workflow state machines and document numbering.
- Docker packaging and CI.

It includes no product UI beyond a placeholder home page. That work starts in Phase 2.

## 2. Architecture decisions

| Decision             | Choice                                                                                                                                     | Why                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Framework            | Next.js 16.3 App Router, Turbopack                                                                                                         | Server Components, server actions, streaming                         |
| Request interception | `src/proxy.ts` (Next 16 renamed `middleware` to `proxy`)                                                                                   | Refreshes the session, protects routes, sets a per-request CSP nonce |
| Rendering            | Root layout reads `headers()`, so pages render dynamically                                                                                 | A nonce CSP can't work on prerendered HTML                           |
| ORM                  | Prisma 7.10 with the `prisma-client` generator and the `@prisma/adapter-pg` driver adapter                                                 | Current Prisma architecture: no Rust query engine, ESM output        |
| Schema layout        | Multi-file schema in `prisma/schema/` (one file per module)                                                                                | Each module owns its models                                          |
| Tenancy              | Shared database with `organizationId` on every tenant row                                                                                  | Simple to operate; isolation enforced twice (below)                  |
| Isolation layer 1    | `getTenantDb(orgId)`: a Prisma extension that injects and checks `organizationId` on every operation and rejects raw or unknown operations | Stops cross-tenant bugs in application code                          |
| Isolation layer 2    | Postgres RLS (`supabase/migrations/0001`); client roles get read-only access to their orgs, and all writes go through the server           | Protects Realtime, Storage and PostgREST                             |
| Authorization        | Permission catalog (`module.resource.action`) plus editable per-tenant roles with 11 system templates                                      | Replaces hard-coded role checks                                      |
| Money                | Integer minor units (`bigint`), half-up rounding                                                                                           | No float errors in prices, discounts or taxes                        |
| Workflows            | Declarative state machines, with a permission on each transition                                                                           | The UI can list the valid actions; each rule is tested               |
| Numbering            | Per-tenant `sequences` table with yearly reset                                                                                             | Replaces client-side counters                                        |
| Stock and audit      | Append-only ledgers enforced by database triggers                                                                                          | Tamper-evident history                                               |
| Fonts                | Self-hosted Inter and JetBrains Mono variable fonts (OFL)                                                                                  | No third-party font requests; fits `font-src 'self'`                 |
| Supabase keys        | New-style publishable and secret keys; `getClaims()` for identity                                                                          | Signature-verified JWT; the secret key is used on the server only    |

## 3. File structure (Phase 1)

```
ai-ems/
├── .github/workflows/ci.yml          quality · database · e2e jobs
├── .husky/{pre-commit,commit-msg}    lint-staged · commitlint
├── docker/{Dockerfile,docker-compose.yml}
├── docs/{01-architecture-blueprint.md,02-phase-1-foundation.md}
├── prisma/
│   ├── schema/  _base · platform · collab · crm · catalog · sales · inventory
│   │            procurement · production · quality · fulfillment · finance
│   └── seed.ts
├── prisma.config.ts
├── supabase/migrations/{0001_rls_foundation.sql,0002_storage.sql}
├── src/
│   ├── app/  layout.tsx · page.tsx · globals.css · icon.svg · robots.ts
│   │         api/health/route.ts · fonts/
│   ├── proxy.ts
│   ├── domain/  money/ · pricing/ · workflow/ · numbering/      (+ tests)
│   ├── server/  db/{prisma,tenant,tenant-scope}.ts · auth/{permissions,authorize}.ts
│   └── lib/     env.ts · env.server.ts · logger.ts · utils.ts · routes.ts
│                security/csp.ts · supabase/{client,server,proxy}.ts
├── tests/  setup.ts · stubs/ · e2e/smoke.spec.ts
├── vitest.config.mts · playwright.config.ts · eslint.config.mjs
└── .prettierrc.json · commitlint.config.mjs · .lintstagedrc.mjs · .editorconfig · .nvmrc
```

## 4. Commands

```bash
# Install
nvm use && npm install

# Configure
cp .env.example .env    # Supabase URL/keys, DATABASE_URL (pooled :6543), DIRECT_URL (:5432)

# Database
npm run db:validate
npm run db:migrate -- --name init
psql "$DIRECT_URL" -f supabase/migrations/0001_rls_foundation.sql
psql "$DIRECT_URL" -f supabase/migrations/0002_storage.sql
SEED_OWNER_EMAIL=you@example.com SEED_OWNER_PASSWORD='<choose one>' npm run db:seed

# Develop
npm run dev

# Verify
npm run check           # typecheck + lint + format + unit tests
npm run build
npm run test:e2e        # builds, starts and tests on desktop + mobile

# Docker
docker compose -f docker/docker-compose.yml up --build
```

## 5. Testing instructions

| Suite                 | Command            | What it proves                                                                                                                                                                                                 |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit (47 tests)       | `npm test`         | Money rounding; pricing breakdown and discount policy; four workflow machines; numbering rollover; tenant-scope injection and cross-tenant refusal; role permissions; open-redirect guard; CSP; env validation |
| E2E + a11y (10 tests) | `npm run test:e2e` | Page renders with no CSP violations or console errors; axe finds no serious or critical WCAG 2.2 AA issues; security headers present; unauthenticated redirect; health endpoint                                |
| Database (CI)         | `database` job     | Schema applies to Postgres 17 and the seed runs                                                                                                                                                                |

Manual checks:

1. Open `/`. It renders in light and dark themes.
2. Open `/demo/dashboard` while signed out. You are redirected to `/login?next=%2Fdemo%2Fdashboard`.
3. Open `/api/health?deep=1`. It returns `database: ok` when the database is reachable, or 503 when it isn't.
4. In a SQL session as `authenticated`, try to `insert into leads …`. RLS denies it.

## 6. Verification checklist

Results from the build sandbox:

- [x] `tsc --noEmit`: 0 errors (strict + `noUncheckedIndexedAccess`)
- [x] `eslint --max-warnings=0`: clean
- [x] `prettier --check`: clean
- [x] `vitest`: 47/47 passing
- [x] `next build`: succeeds
- [x] `playwright`: 10/10 passing (desktop + mobile), with CSP nonce verified on every script
- [x] `prisma validate` and `prisma generate`: 52 models, valid
- [x] `npm audit`: 0 vulnerabilities (npm overrides patch the transitive `mysql2` and `deepmerge-ts` advisories)
- [x] No reference-app code, branding, assets or data. Sample tenant is "Demo Industries".
- [ ] `prisma migrate dev` against a real database. This needs your Supabase project; the sandbox blocks Prisma's engine download.
- [x] RLS and storage SQL applied to PostgreSQL 16 with Supabase-style stub schemas. Verified: a member sees only their org's rows and only their own notifications; client inserts are blocked; `has_permission` is scoped to the org; the stock ledger rejects updates; auth users sync to profiles; the script re-runs cleanly.
- [ ] RLS SQL applied on your real Supabase project.
- [ ] Docker image build. Docker isn't available in the sandbox.

## 7. Known environment notes

- **Sandbox only:** `binaries.prisma.sh` and `fonts.googleapis.com` are blocked here. Neither affects a normal machine or CI. To validate the schema offline, set `PRISMA_SCHEMA_ENGINE_BINARY` to any stub, because `validate` and `generate` use the bundled WASM.
- **Playwright:** if your installed browsers don't match the Playwright version, set `PLAYWRIGHT_CHROMIUM_PATH` to point at a local Chromium.
- **Next.js 16 docs** ship in `node_modules/next/dist/docs/`, and `AGENTS.md` points to them. Check them before using an API you haven't used in this version.

## 8. Next: Phase 2 (for approval)

- Design system: shadcn/ui primitives on the tokens in `globals.css`, typography scale, and dense data-table styles.
- App shell: collapsible sidebar driven by permissions, top bar with org switcher, ⌘K command palette, notifications, theme toggle.
- Auth: login, sign-up, magic link, OAuth callback, forgot and reset password, MFA enrolment.
- Onboarding: create or join an organization, which provisions the system roles and sequences.
- Request context: `getRequestContext()` resolving user → membership → permissions → tenant DB.
