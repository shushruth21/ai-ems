# Phase 5 — Platform

**Status:** complete, waiting for approval before Phase 6 (CRM).
**Builds on:** Phase 4 organizations (`778f9ca`). Earlier work was not redesigned; changes to existing files are in §2.
**Decision record:** [ADR 0009](../architecture/adr/0009-outbox-worker-roles-and-api-keys.md).

Custom roles, the audit log UI, notifications with a background worker and a real email transport, and
workspace API keys with a first `/api/v1` surface.

## 1. Architecture

```
server action ─┬─ change (members, roles, settings)  ─┐  one transaction
               └─ audit_events row  +  outbox_events row ┘
                                                    │
tools/worker (own process, any number of replicas)  ▼
  requeueStuckOutbox → claimOutboxBatch (FOR UPDATE SKIP LOCKED)
      → handlers[type]  → notifications rows        → in-app inbox  /<slug>/notifications
                        → packages/mail (log|none|smtp|resend) → email
      → completeOutbox | failOutbox (backoff → FAILED after 8 attempts)

/<slug>/settings/roles     roles + permission matrix, capped by the editor's own permissions
/<slug>/settings/audit     keyset-paginated audit trail with filters
/<slug>/settings/api-keys  issue once · scopes · expiry · revoke
/api/v1/{workspace,members}  Bearer <api key> → workspace resolved from the key, never the request
```

| Concern       | Where                                          | Notes                                                 |
| ------------- | ---------------------------------------------- | ----------------------------------------------------- |
| Role rules    | `packages/domain/organization/role-policy.ts`  | Pure; no privilege escalation, in either direction    |
| Contracts     | `packages/contracts/src/platform.ts`           | Roles, audit filters, notifications, API keys         |
| Persistence   | `packages/db/src/platform/{roles,outbox,…}.ts` | Transactions + audit rows; claim/complete/fail        |
| Worker        | `tools/worker`                                 | Poll loop, handlers, optional `/healthz`              |
| Email         | `packages/mail`                                | One `Mailer`, four transports, never throws           |
| Machine auth  | `apps/web/src/server/api/key-auth.ts`          | Bearer key → prefix lookup → timing-safe hash compare |
| Notifications | `app/[org]/notifications`, topbar bell         | Scoped to `(organizationId, recipientId)`             |

## 2. Folder structure (added or changed)

```
packages/domain/src/organization/role-policy.ts   NEW  escalation rules, role key, limits (+ tests)
packages/contracts/src/platform.ts                NEW  role, audit filter, notification, API-key schemas (+ tests)
packages/mail/                                    NEW  types.ts · mailer.ts (log|none|smtp|resend) (+ tests)
packages/db/src/platform/
  roles.ts                                        NEW  list/create/update/delete with policy + audit
  outbox.ts                                       NEW  enqueue · claim · complete · fail · requeue · stats
  notifications.ts                                NEW  create · list · unread · mark read · recipients
  api-keys.ts                                     NEW  generate · hash · verify · revoke (+ unit tests)
  audit.ts                                        CHG  filters, keyset pagination, distinct actions
  invitations.ts · members.ts · organizations.ts  CHG  enqueue outbox events in the same transaction
packages/db/tests/integration/platform-extras.test.ts  NEW  6 tests against the real migrations
packages/config/src/env.ts                        CHG  MAIL_* · SMTP_URL · RESEND_API_KEY · WORKER_*
tools/worker/                                     NEW  runner.ts · handlers.ts · main.ts (+ tests)
apps/web/src/
  app/[org]/settings/{roles,audit,api-keys}/page.tsx   NEW
  app/[org]/notifications/page.tsx                     NEW
  app/api/v1/{workspace,members}/route.ts              NEW
  features/platform/{actions.ts,components/*}          NEW  roles · api keys · inbox
  server/api/key-auth.ts                               NEW  Bearer authentication for /api/v1
  server/mail/mailer.ts                                CHG  now wraps packages/mail
  components/layout/notifications-button.tsx           CHG  real data, links to the inbox
  app/[org]/layout.tsx · types/shell.ts                CHG  newest notifications + unread count
  config/navigation.ts                                 CHG  Roles · Audit log · API keys entries
playwright.config.ts                              CHG  starts the worker; MAIL_TRANSPORT=none
tools/developer/dev-local.mjs                     CHG  supervises the worker; MAIL_TRANSPORT=log
docs/architecture/adr/0009-…md                    NEW
```

## 3. Database changes

No migration: `roles`, `role_permissions`, `notifications`, `outbox_events` and `api_keys` were created by
`20260922162750_init`. This phase is the first to write to the last three. `pnpm db:diff:wasm` prints
nothing, which CI enforces.

Tables now in use:

| Table           | Written by                                    | Notes                                                             |
| --------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `outbox_events` | repositories (same transaction as the change) | `status`, `attempts`, `available_at`, `last_error`                |
| `notifications` | the worker                                    | `(organization_id, recipient_id)` scoped; `read_at`               |
| `api_keys`      | settings actions                              | `key_hash` (SHA-256), `prefix` unique, `scopes[]`, `last_used_at` |

## 4. API design

| Route                   | Auth                 | Returns                                                       |
| ----------------------- | -------------------- | ------------------------------------------------------------- |
| `GET /api/v1/workspace` | `Bearer <key>`, read | The key's workspace: id, slug, name, plan, currency, timezone |
| `GET /api/v1/members`   | `Bearer <key>`, read | Members with role, status and join date                       |
| `GET /healthz` (worker) | none (private port)  | `{ status, queue: { PENDING, PROCESSING, DONE, FAILED } }`    |

Errors are `{ error, message }`: `401` for a missing, unknown, revoked or expired key (all identical),
`403` when the key lacks the scope. Responses are `no-store`.

## 5. Components

| Component             | Kind   | Notes                                                                                                |
| --------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| `RolesManager`        | client | Role list, permission matrix by module; checkboxes the editor can't grant are disabled and explained |
| `ApiKeysManager`      | client | Create form, one-time token box with copy, revoke per row                                            |
| `NotificationsInbox`  | client | Unread count, mark one / mark all                                                                    |
| `NotificationsButton` | client | Topbar bell: newest eight, unread dot, link to the inbox                                             |
| Audit page            | server | `<form>` GET filters + `<details>` per change — no client JS needed                                  |

## 6. Server actions

`features/platform/actions.ts` — `createCustomRole`, `updateCustomRole`, `deleteCustomRole`
(`platform.roles.manage`), `markRead`, `markAllRead` (any member), `createKey`, `revokeKey`
(`platform.settings.manage`). Each re-resolves membership from the slug with `requireOrgContext`, parses
with the Zod contract, and lets the repository apply the policy inside its transaction.

## 7. Prisma models

Unchanged. `Role`, `RolePermission`, `Notification`, `OutboxEvent` and `ApiKey` are read/written for the
first time; `OutboxEvent.id` and `AuditEvent.id` are `BigInt`, which the repositories convert at the edge
so ids leave the package as strings.

## 8. UI

Three new settings pages and an inbox, all inside the existing shell. Roles are cards with a permission
matrix grouped by module; the audit log is a table with filters and an "Older events" link (keyset, not
page numbers); API keys show the token exactly once with a copy button. Axe finds no serious or critical
violations on any of them, on desktop and mobile.

## 9. Validation

`packages/contracts/src/platform.ts`: role name length and at least one permission, permission keys from
`ALL_PERMISSIONS`, audit dates as real calendar dates (`2026-13-99` is rejected), cursors as digits only,
API-key names and 1–365 day expiry. The domain layer adds the rules that need context — escalation, system
roles, member counts, the 30-role cap.

## 10. Tests

| Suite                       | Count | Covers                                                               |
| --------------------------- | ----- | -------------------------------------------------------------------- |
| Unit (domain, contracts)    | +26   | Role policy both directions, date refinement, key parsing            |
| Worker (`tools/worker`)     | 5     | Handler → notification → email, unknown events, backoff, dead-letter |
| Mail (`packages/mail`)      | 4     | Each transport; `send()` never throws                                |
| Integration (`packages/db`) | 27    | Roles, audit paging/filters, outbox concurrency, notifications, keys |
| E2E (`tests/e2e/platform`)  | 10    | Role lifecycle, audit filters, join → notification, key → `/api/v1`  |

Totals: `pnpm check` 35 tasks green (236 unit/component tests), 27 integration, 106 e2e passed / 8 skipped.

## 11. Commands

```bash
pnpm dev:local                      # database + emulator + worker + app
pnpm --filter @ai-ems/worker start  # worker alone (WORKER_HEALTH_PORT=4000 for /healthz)

pnpm check                          # typecheck · lint · unit tests · formatting
TEST_DATABASE_URL=postgresql://… pnpm test:integration
pnpm test:e2e                       # starts emulator + worker + app
```

## 12. Verification checklist

- [x] Events are enqueued in the same transaction as the change that caused them
- [x] Two workers never process the same event; failures back off and park after 8 attempts
- [x] A crashed worker's in-flight events are requeued after five minutes
- [x] Unknown event types drain the queue with a log line instead of retrying forever
- [x] Email failures never duplicate an in-app notification; recipients are never logged
- [x] Custom roles can't grant — or remove — a permission the editor doesn't hold
- [x] System roles are read-only; a role with members can't be deleted; 30 custom roles maximum
- [x] Audit log pages by keyset, filters validate, future dates return nothing
- [x] Notifications are readable and markable only by their recipient
- [x] API keys: stored hashed, shown once, scope-checked, expire, revoke takes effect immediately
- [x] `pnpm check`, integration and e2e green; no serious axe violations on the new pages
- [ ] Retention jobs for `DONE` outbox rows and old audit events (operations runbook, next)

## Next: Phase 6 (CRM), for approval

- Leads, accounts and contacts with ownership and assignment.
- Pipeline stages and activity timeline, on the tenant-scoped client.
- First use of the module permissions (`crm.*`) the role editor already exposes.
