# Phase 2.5 — Monorepo restructure & repository governance

**Why:** you asked for the enterprise repository layout (apps/packages, docs, governance, CI/CD). I adapted the template to AI EMS's TypeScript core. The rationale is in [ADR 0001](../architecture/adr/0001-monorepo-pnpm-turborepo.md). This phase changes no product behavior.

## Path mapping

| Before                                                                                                                                                                      | After                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/app`, `src/features`, `src/config`, `src/types`, `src/proxy.ts`, `src/components/{layout,providers}`, `src/lib/routes.ts`, `public/`, `tests/component`, `tests/utils` | `apps/web/…` (same relative paths)                                                                 |
| `src/components/{ui,data,brand}`, `src/hooks`, `src/lib/{utils,format,status,hotkeys}`, `src/styles/{globals.css,tokens.ts}`                                                | `packages/ui/src/…` → `@ai-ems/ui/…`                                                               |
| `src/styles/fonts*`                                                                                                                                                         | `apps/web/src/styles/` (next/font must be called in the app). `app.css` imports the UI stylesheet. |
| `src/domain/**`                                                                                                                                                             | `packages/domain/src/**` → `@ai-ems/domain/…`                                                      |
| `src/server/auth/{permissions,authorize}`                                                                                                                                   | `packages/security/src/authorization/` → `@ai-ems/security/authorization/…`                        |
| `src/lib/supabase/*`                                                                                                                                                        | `packages/security/src/authentication/supabase/*`                                                  |
| `src/lib/security/csp`                                                                                                                                                      | `packages/security/src/http/csp`                                                                   |
| `src/server/db/*`, `prisma/`, `prisma.config.ts`                                                                                                                            | `packages/db/…` → `@ai-ems/db/{client,tenant,tenant-scope,generated/*}`                            |
| `src/lib/env*`                                                                                                                                                              | `packages/config/src/` → `@ai-ems/config/env`, `…/env.server`                                      |
| `src/lib/logger`                                                                                                                                                            | `packages/observability/src/logger`                                                                |
| `docker/`                                                                                                                                                                   | `infrastructure/docker/` (Dockerfile rewritten for `turbo prune`)                                  |
| `docs/0x-*.md`                                                                                                                                                              | `docs/architecture/blueprint.md`, `docs/phases/*`                                                  |

The move used `git mv` for all 172 files, so history is preserved. A script resolved every `@/` import to its new location: a relative path inside a package, the package's public path across packages.

## Added

- **Tooling:**
  - pnpm workspace with a dependency **catalog**
  - `turbo.json`
  - shared `@ai-ems/tsconfig` and `@ai-ems/eslint-config` (base, react, next)
  - per-package Vitest configs
  - ESLint per-file config lookup in lint-staged
  - `Makefile` and `tools/developer/doctor.mjs`
- **Database:**
  - `packages/db/tests/integration/rls.test.ts`: **9 tests** against real PostgreSQL. They apply the actual `supabase/migrations/*.sql` to a throwaway database. A new case checks that SUSPENDED memberships grant nothing.
  - `infrastructure/scripts/apply-supabase-sql.sh`
- **Config:** `packages/config/src/flags.ts` (typed feature flags with environment overrides, tested) and `config/environments/*.env.example`.
- **Repository policy files:** `CONTRIBUTING.md`, `CODEOWNERS`, `SECURITY.md`, `LICENSE`, PR and issue templates, `dependabot.yml`.
- **Workflows:**
  - `ci` (quality, database, e2e)
  - `security-scan` (CodeQL, dependency audit and review, gitleaks, Trivy)
  - `build-container` (GHCR, SBOM, provenance, image scan)
  - `db-migrate` (reusable)
  - `deploy-preview`, `deploy-staging`, `deploy-production` (the last requires approval)
- **Docs:**
  - architecture: system context, containers, components, data flow, multi-tenancy, AI architecture, threat model
  - ADRs 0001–0006
  - product: requirements, personas, acceptance criteria
  - operations: SLOs, incident response, DR, runbooks
  - governance: data classification, retention, responsible AI, AI model risk, compliance evidence
  - API: OpenAPI and event envelope schema
- **Reserved directories:** `services/`, `ml/`, `evals/`, `infrastructure/terraform/`. Each has a README with its plan. There are no empty scaffolds.

## Deliberately not adopted from the template

| Template item                                        | Why not                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Root `pyproject.toml` / `uv.lock`                    | The core is TypeScript. Python gets its own uv workspace under `services/` in Phase 20.            |
| `apps/api-gateway`                                   | Next.js route handlers and `proxy.ts` cover this. Add a gateway only if several backends need one. |
| Kubernetes / Helm                                    | Managed Vercel + Supabase. Docker covers self-hosting.                                             |
| `ml/{vision,ranking,nlp}` and empty pipeline folders | Not product needs. Forecasting and scoring arrive in Phase 20.                                     |
| Model registry ADR                                   | Replaced by ADRs for decisions we actually made                                                    |

## Verification

- `pnpm check`: typecheck, lint and unit/component tests across 8 workspaces (22 turbo tasks) plus Prettier. **116 tests** (the 113 from before plus 3 feature-flag tests).
- `pnpm test:integration`: **9/9** on PostgreSQL 16.
- `next build` succeeds. Tailwind picks up package sources through `@source` (verified in the output CSS).
- Playwright: **37/37** on desktop and mobile (a new `tests/security` suite plus the existing e2e), with axe clean.
- `turbo prune @ai-ems/web --docker`: the pruned lockfile installs with `--frozen-lockfile`. The pruned build produces `apps/web/server.js`, and the standalone server served `/api/health`, a preview page and its CSS (all 200).
- Workflows: YAML valid. actionlint (WASM build) is clean apart from outdated false positives about the `vars` context and the `attestations` permission, both of which are current GitHub features.
- `pnpm audit`: 0 vulnerabilities.
