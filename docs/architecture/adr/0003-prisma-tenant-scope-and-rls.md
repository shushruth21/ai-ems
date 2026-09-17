# 0003. Prisma with an application tenant guard plus Postgres RLS

- **Status:** accepted
- **Date:** 2026-09-17

## Context

Prisma connects with a privileged role and bypasses RLS. Relying on RLS alone would require per-request `set_config` with pooled connections. Relying on application code alone makes one missed `where` a data leak.

## Decision

Use two layers:

1. **`getTenantDb(orgId)`**, a Prisma client extension. It injects and verifies `organizationId` on every operation, and refuses raw or unknown operations.
2. **RLS policies**, which cover every client-reachable path: Realtime, Storage and PostgREST. They are read-only for `authenticated`.

Use Prisma 7 with the `prisma-client` generator and the `@prisma/adapter-pg` driver adapter.

## Consequences

- Both layers are tested: unit tests for the guard, integration tests for RLS on real Postgres.
- Nested writes must use unchecked inputs with scalar ids.
- Raw SQL requires an explicit reviewed path.
