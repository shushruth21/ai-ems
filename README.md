# AI EMS — AI-Powered Enterprise Management System

Multi-tenant SaaS for make-to-order businesses. It covers CRM, the product configurator, sales, inventory, procurement, production, quality, fulfillment and finance, with an AI copilot on top.

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth, Postgres, Storage, Realtime) · Prisma 7 · TanStack Query · React Hook Form + Zod · Vitest · Playwright

- Architecture: [`docs/01-architecture-blueprint.md`](docs/01-architecture-blueprint.md)
- Phase 1 guide: [`docs/02-phase-1-foundation.md`](docs/02-phase-1-foundation.md)

## Quick start

```bash
nvm use                      # Node 22
npm install                  # also runs `prisma generate`
cp .env.example .env         # fill in Supabase + database values
npm run db:migrate           # create tables (first run: name the migration "init")
psql "$DIRECT_URL" -f supabase/migrations/0001_rls_foundation.sql
psql "$DIRECT_URL" -f supabase/migrations/0002_storage.sql
npm run db:seed              # permission catalog + "Demo Industries" sample tenant
npm run dev                  # http://localhost:3000
```

## Scripts

| Script                                                                               | Purpose                                                                         |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `dev` / `build` / `start`                                                            | Next.js (Turbopack)                                                             |
| `typecheck` · `lint` · `format:check`                                                | Static checks (all run in CI and pre-commit)                                    |
| `test` · `test:e2e`                                                                  | Vitest unit tests · Playwright smoke + accessibility tests (desktop and mobile) |
| `check`                                                                              | Typecheck + lint + format + unit tests in one go                                |
| `db:generate` · `db:validate` · `db:migrate` · `db:deploy` · `db:seed` · `db:studio` | Prisma                                                                          |

## Project layout

```
prisma/schema/*.prisma   multi-file schema (52 models)
prisma/seed.ts           generic sample data (no hard-coded credentials)
supabase/migrations/     RLS, storage buckets, triggers (applied after Prisma)
src/app/                 routes (App Router), proxy-driven auth + CSP
src/domain/              pure business logic: money, pricing, workflows, numbering
src/server/              server-only: Prisma, tenant scoping, authorization
src/lib/                 env validation, Supabase clients, security helpers
tests/                   unit setup, e2e specs
docker/                  production Dockerfile + local compose
```

## Commit conventions

[Conventional Commits](https://www.conventionalcommits.org), enforced by commitlint. Example: `feat(sales): add quote approval`.
The pre-commit hook runs ESLint and Prettier on staged files.

## License and credits

- Proprietary. © AI EMS.
- Inter and JetBrains Mono are bundled under the SIL Open Font License 1.1 (see `src/app/fonts/`).
