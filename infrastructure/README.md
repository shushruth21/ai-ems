# Infrastructure

| Path                            | Purpose                                                                           | Status   |
| ------------------------------- | --------------------------------------------------------------------------------- | -------- |
| `docker/`                       | Production image (Turborepo-pruned, standalone Next.js) and local compose         | ready    |
| `scripts/apply-supabase-sql.sh` | Applies `supabase/migrations/*.sql` after Prisma migrations                       | ready    |
| `terraform/`                    | Supabase project, Vercel project and environment variables, DNS, rate-limit store | Phase 24 |

Kubernetes and Helm are intentionally absent: the platform runs on managed Vercel and Supabase ([ADR 0001](../docs/architecture/adr/0001-monorepo-pnpm-turborepo.md)). Add them only for self-hosted deployments.
