# Contributing to AI EMS

## Setup

```bash
corepack enable          # uses the pnpm version pinned in package.json
make install             # pnpm install + Prisma client
cp .env.example .env     # fill in Supabase + database values
make doctor              # verifies toolchain and .env
make dev                 # http://localhost:3000 (UI sandbox at /preview)
```

## Repository layout

| Path                     | What lives there                                                | Rules                                                          |
| ------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------- |
| `apps/web`               | Next.js app: routes, server actions, route handlers, feature UI | Server-first. Business rules go in `packages/domain`.          |
| `packages/domain`        | Pure business logic (money, pricing, workflows, numbering)      | No framework, database or network imports (enforced by ESLint) |
| `packages/db`            | Prisma schema, client, tenant scope, seed                       | Only package that talks to Postgres directly                   |
| `packages/security`      | Permissions, authorization, Supabase auth clients, CSP          | No database access                                             |
| `packages/ui`            | Design system: tokens, primitives, data components              | No app-specific imports                                        |
| `packages/config`        | Environment validation, feature flags                           | —                                                              |
| `packages/observability` | Logging (then metrics and tracing)                              | —                                                              |
| `supabase/`              | RLS, storage and trigger SQL, plus SQL test fixtures            | Idempotent scripts, applied after Prisma migrations            |
| `docs/`                  | Architecture, ADRs, product, operations, governance             | Update in the same PR as the change                            |
| `tests/`                 | Cross-app suites (e2e, security)                                | Package-owned tests stay next to their code                    |

Dependency direction: `apps/*` → `packages/{ui, db, security, config, observability, domain}`.
`packages/db` → `packages/security` → `packages/config`.
`packages/domain` depends on nothing.

## Workflow

1. Branch from `main`: `feat/sales-quote-approval`, `fix/…`, `chore/…`.
2. Write the test first for domain logic. Every new server action needs:
   - a Zod schema
   - `authorize(...)`
   - `getTenantDb(...)`
   - an audit event
3. Commit with [Conventional Commits](https://www.conventionalcommits.org): `feat(sales): add quote approval`. Scopes are listed in `commitlint.config.mjs`. Pre-commit runs ESLint and Prettier on staged files.
4. Run `make check` (and `make e2e` for UI changes) before opening a PR, then fill in the PR checklist.
5. Architecture-level decisions get an ADR in `docs/architecture/adr/`. Copy `0000-template.md`.

## Tests

| Kind                                          | Where                                                      | Command                                     |
| --------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------- |
| Unit                                          | `packages/*/src/**/*.test.ts`, `apps/web/src/**/*.test.ts` | `make test`                                 |
| Component (jsdom)                             | `packages/ui/tests`, `apps/web/tests/component`            | `make test`                                 |
| Integration (Postgres, RLS)                   | `packages/db/tests/integration`                            | `TEST_DATABASE_URL=… make test-integration` |
| End-to-end + accessibility + security headers | `tests/e2e`, `tests/security`                              | `make e2e`                                  |

## Adding a UI primitive

Add it to `packages/ui/src/components/ui/`, following the existing pattern:

- Radix + `cva`
- `data-slot` attributes
- semantic tokens only

Then add it to the design-system page (`/preview/demo/design-system`). The shadcn CLI works from `packages/ui` (see its `components.json`).

## Data and IP hygiene

- Never commit secrets, real customer data or third-party proprietary material.
- Sample data must be synthetic. See `docs/governance/data-classification.md`.
