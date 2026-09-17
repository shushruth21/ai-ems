# Runbook: deploy

| Environment | Trigger                              | Workflow                                                                   |
| ----------- | ------------------------------------ | -------------------------------------------------------------------------- |
| Preview     | Pull request                         | `deploy-preview.yml`                                                       |
| Staging     | Merge to `main`                      | `deploy-staging.yml`: CI → migrate → deploy → smoke test                   |
| Production  | GitHub release, or manual with a tag | `deploy-production.yml`: CI → migrate → **approval** → deploy → smoke test |

## Pre-flight

- [ ] Migrations are backward-compatible with the running version (expand → migrate → contract).
- [ ] New environment variables are added to the Vercel and GitHub environments.
- [ ] The Supabase SQL scripts are idempotent.

## Rollback

1. Vercel → Deployments → the previous deployment → **Instant Rollback**.
2. If a migration caused the problem, follow `disaster-recovery.md` scenario 2.
