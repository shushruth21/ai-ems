# AI EMS — AI-Powered Enterprise Management System

Multi-tenant SaaS for make-to-order businesses. It covers the full cycle from lead to quote, order, production, quality check, shipment, invoice and service, with an AI copilot that never changes data without approval.

**Stack:**

- **Frontend:** Next.js 16 · React 19 · TypeScript (strict) · Tailwind CSS v4 · Radix/shadcn · TanStack Query / Table v9 · React Hook Form + Zod
- **Data and auth:** Supabase (Auth, Postgres, Storage, Realtime) · Prisma 7
- **Tooling:** pnpm + Turborepo · Vitest · Playwright + axe

## Quick start

```bash
corepack enable
make install                 # pnpm install + Prisma client
cp .env.example .env         # Supabase + database values
make doctor                  # checks toolchain and .env
make db-deploy               # Prisma migrations + Supabase SQL (RLS, storage, triggers)
make db-seed                 # permission catalog + "Demo Industries" sample tenant
make dev                     # http://localhost:3000 — UI sandbox at /preview
```

Run `make help` to list every task.

## Repository

```
ai-ems/
├── apps/
│   └── web/                  Next.js app: routes, server actions, feature UI, app shell
├── packages/
│   ├── domain/               pure business logic (money, pricing, workflows, numbering)
│   ├── db/                   Prisma schema (52 models), tenant-scoped client, seed, RLS tests
│   ├── security/             permissions & authorization, Supabase auth clients, CSP
│   ├── ui/                   design system: tokens, 32 primitives, data table, KPI cards
│   ├── config/               env validation, feature flags
│   ├── observability/        structured logging
│   ├── tsconfig/             shared TypeScript presets
│   └── eslint-config/        shared lint rules (domain purity enforced)
├── supabase/                 RLS/storage/trigger SQL + test fixtures
├── services/ · ml/ · evals/  reserved for the Python AI services (Phases 20–21)
├── config/                   per-environment templates
├── infrastructure/           Docker (turbo-pruned standalone image), scripts, Terraform (Phase 24)
├── tests/                    cross-app suites: e2e, security
├── tools/                    developer tooling (doctor)
├── docs/                     architecture + ADRs, product, phases, operations, governance, API
└── .github/                  CI, security scans, container build, preview/staging/production deploys
```

## Documentation

| Topic                                        | Location                                                       |
| -------------------------------------------- | -------------------------------------------------------------- |
| Architecture overview and C4 diagrams        | [docs/architecture](docs/architecture/README.md)               |
| Decisions                                    | [docs/architecture/adr](docs/architecture/adr/README.md)       |
| Requirements and definition of done          | [docs/product](docs/product/requirements.md)                   |
| Phase reports                                | [docs/phases](docs/phases/README.md)                           |
| Operations (SLOs, incidents, DR, runbooks)   | [docs/operations](docs/operations/service-level-objectives.md) |
| Governance (data, retention, responsible AI) | [docs/governance](docs/governance/data-classification.md)      |
| API and event contracts                      | [docs/api](docs/api/openapi.yaml)                              |
| Contributing                                 | [CONTRIBUTING.md](CONTRIBUTING.md)                             |
| Security                                     | [SECURITY.md](SECURITY.md)                                     |

## License

Proprietary. See [LICENSE](LICENSE). Bundled fonts (Inter, JetBrains Mono) are licensed under SIL OFL 1.1.
