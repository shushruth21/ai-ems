# 0001. Monorepo with pnpm workspaces and Turborepo

- **Status:** accepted
- **Date:** 2026-09-17

## Context

AI EMS will grow to include:

- a web app
- a background worker
- Python AI and ingestion services
- shared UI, domain, database and security code

A single Next.js `src/` tree mixes these concerns and makes boundaries unenforceable. A generic ML-platform template (root `pyproject.toml`, Kubernetes, model registry) was considered, but the product core is TypeScript on managed infrastructure.

## Decision

- Use **pnpm workspaces** (`apps/*`, `packages/*`), with a **catalog** for shared dependency versions.
- Use **Turborepo** for task orchestration and caching.
- Internal packages are **source-consumed**: TypeScript `exports` with no build step. Next.js `transpilePackages` compiles them.
- Python services join later under `services/` with their own **uv** workspace. They are not a root `pyproject.toml`.
- Kubernetes and Helm are deferred. Deployment targets Vercel and Supabase, with Docker available for self-hosting.

## Consequences

- Package boundaries are explicit, and ESLint enforces domain purity.
- Tasks are cached and run in parallel.
- `turbo prune` produces minimal Docker contexts. This is verified: the pruned install and the standalone server both work.
- Tailwind must be told about package sources (`@source`).
- ESLint runs per workspace (`v10_config_lookup_from_file` for staged files).

## Alternatives considered

- **Nx:** more features, but heavier. Not needed yet.
- **Single package:** simpler, but provides no enforced boundaries.
- **Python-first template:** mismatched with the TypeScript core.
