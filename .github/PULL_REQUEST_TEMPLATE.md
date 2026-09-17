## What & why

<!-- One or two sentences. Link the issue: Closes #123 -->

## Changes

-

## Checklist

- [ ] `pnpm check` passes (typecheck, lint, unit tests, format)
- [ ] Tests added/updated for new behavior (unit, component, e2e as relevant)
- [ ] Permissions enforced on the server for any new action or route
- [ ] Tenant scope (`getTenantDb`) used for all tenant data; RLS updated if a new table is exposed
- [ ] Database changes include a Prisma migration and, if needed, `supabase/migrations/*.sql`
- [ ] UI is keyboard-accessible, labelled, works in light/dark and on mobile
- [ ] Docs/ADR updated if architecture or behavior changed
- [ ] No secrets, real customer data or third-party proprietary material

## Screenshots / recordings

<!-- For UI changes -->
