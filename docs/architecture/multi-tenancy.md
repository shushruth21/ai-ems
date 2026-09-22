# Multi-tenancy

**Model:** a shared database and shared schema. Every tenant-owned row carries `organization_id`, and every composite index starts with it.

## Invariants (tested)

| #   | Invariant                                                                                                         | Enforced by                         | Test                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| T1  | Application reads and writes on tenant models always carry the caller's `organizationId`                          | `getTenantDb()` → `scopeArgs()`     | `packages/db/src/tenant-scope.test.ts`                                              |
| T2  | Cross-tenant writes, and changing a row's `organizationId`, are refused                                           | `scopeArgs()`                       | same                                                                                |
| T3  | Raw SQL and unknown operations on tenant models are refused                                                       | `scopeArgs()`                       | same                                                                                |
| T4  | Client roles (`authenticated`) see only rows of orgs where their membership is ACTIVE                             | RLS `tenant_read` policies          | `packages/db/tests/integration/rls.test.ts`                                         |
| T5  | Client roles cannot write tenant tables directly                                                                  | No write policies                   | same                                                                                |
| T6  | Notifications are visible only to their recipient; API keys, invitations and the outbox are never client-readable | Specific policies                   | same                                                                                |
| T7  | Ledgers (`stock_movements`, `audit_events`) are append-only                                                       | Triggers                            | same                                                                                |
| T8  | Storage objects are readable only under the caller's org prefix                                                   | `storage.objects` policy            | Phase 5 test                                                                        |
| T9  | Only ACTIVE members resolve a workspace; non-members and suspended members get 404                                | `getOrgContext()`                   | `packages/db/tests/integration/platform.test.ts`, `tests/e2e/organizations.spec.ts` |
| T10 | A workspace always keeps one active owner, and only owners grant the owner role                                   | Membership policy + advisory lock   | same                                                                                |
| T11 | Workspaces that require MFA are invisible to aal1 sessions, in the app and in SQL                                 | Layout gate + `app.mfa_satisfied()` | `rls.test.ts`, e2e                                                                  |

## Request context

```
session (verified JWT) → profile → membership(org slug) → role → permissions → getTenantDb(org.id)
```

The active org comes from the URL segment `/[org]`. `getOrgContext(slug)` resolves it once per request (React `cache`) and every server action re-resolves it from the slug it was given — the client never supplies an organization id. Platform tables (organizations, memberships, roles, invitations) are read through the root client with an explicit id; business data goes through `getTenantDb()`.

## Scaling path

| Stage | Trigger                          | Action                                                                  |
| ----- | -------------------------------- | ----------------------------------------------------------------------- |
| 1     | Now                              | Shared schema, composite indexes, RLS                                   |
| 2     | Hot tables above ~50M rows       | Partition by `organization_id` hash (ledgers, audit, notifications)     |
| 3     | Enterprise isolation requirement | Dedicated database per tenant, with the same schema and a routing table |
