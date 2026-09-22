# Phase 4 — Organization & multi-tenancy

**Status:** complete, waiting for approval before Phase 5 (Platform).
**Builds on:** Phase 3 authentication (`8b4db13`). Earlier work was not redesigned; changes to existing files are in §2.
**Decision record:** [ADR 0008](../architecture/adr/0008-workspace-routing-and-membership.md).

This phase also removed two long-standing blockers: the repo now has **real Prisma migrations** (generated
without engine downloads) and a **one-command local stack** (`pnpm dev:local`) that needs no Supabase account.

## 1. Architecture

```
/login ──▶ /app ──▶ last workspace ─┐          /invite/<token> ──▶ accept ──▶ /<slug>/dashboard
             └─ no workspace ─▶ /onboarding ──▶ provisionOrganization()
                                                         │
apps/web/src/app/[org]/…                                 ▼
  layout  getOrgContext(slug): session → membership → role → permissions → tenant client
          │  non-member / suspended → 404      requireMfa && aal1 → gate
  pages   dashboard · settings · settings/members · [...slug] placeholders
                                                         │
packages/db/src/platform/*  organizations · members · invitations · profiles · audit
  pure rules from packages/domain/organization/*  (slug, membership policy, invitation state)
                                                         │
PostgreSQL: advisory-locked membership transactions · audit_events · RLS (tenant + app.mfa_satisfied)
```

| Concern           | Where                                                  | Notes                                                            |
| ----------------- | ------------------------------------------------------ | ---------------------------------------------------------------- |
| Routing           | `app/[org]/…`, `app/app/page.tsx`, `lib/routes.ts`     | Slug segment, reserved words, last-workspace cookie              |
| Access resolution | `server/org/context.ts`                                | One cached lookup per request; `requireOrgContext(slug, …perms)` |
| Rules             | `packages/domain/organization/*`                       | Pure, unit-tested: slugs, membership policy, invitations         |
| Persistence       | `packages/db/src/platform/*`                           | Transactions + audit rows; root client, explicit org id          |
| Email             | `server/mail/mailer.ts`                                | `log` in development, `none` in production (copyable link)       |
| Local stack       | `tools/developer/dev-local.mjs`, `tools/auth-emulator` | Database + emulator + app, restarts crashed processes            |
| Migrations        | `packages/db/scripts/migrate-wasm.ts`                  | Prisma's schema engine as WASM — no `binaries.prisma.sh`         |

## 2. Folder structure (added or changed)

```
packages/domain/src/organization/          NEW  slug.ts · membership-policy.ts · invitation.ts (+ tests)
packages/contracts/src/organization.ts     NEW  create/update workspace, invite, role, token schemas
packages/db/
  prisma/migrations/                       NEW  20260922162750_init · 20260922163656_organizations · schema.snapshot.prisma
  prisma/schema/platform.prisma            CHG  organizations.require_mfa; invitations.accepted_by_id, revoked_at
  scripts/migrate-wasm.ts                  NEW  create | deploy | diff without engine binaries
  scripts/apply-sql.ts                     NEW  Supabase SQL applier in Node (no psql needed)
  src/platform/*                           NEW  organizations · members · invitations · profiles · audit · types
  load-env.ts                              NEW  loads the repo-root .env for db tooling
  tests/integration/platform.test.ts       NEW  21 tests against the real migrations
packages/ui/src/components/ui/native-select.tsx  NEW  styled native <select> for long lists
packages/security/…/rate-limit.ts          CHG  org-create · invite · invite-accept limits
packages/config/src/env.ts                 CHG  MAIL_TRANSPORT (+ mailTransport())
apps/web/src/
  app/app/page.tsx                         NEW  landing: last workspace → first → onboarding
  app/[org]/{layout,page,dashboard,settings,settings/members,[...slug]}  NEW
  app/(standalone)/{layout,account,onboarding,invite/[token]}            NEW/moved
  features/organizations/{actions.ts,options.ts,components/*}            NEW
  server/org/{context.ts,last-org.ts} · server/mail/mailer.ts            NEW
  lib/use-action-form.ts · components/forms/form-feedback.tsx            moved (shared by both features)
  proxy.ts · lib/routes.ts                 CHG  /app default, /invite public, last-workspace cookie
  next.config.ts                           CHG  loads the root .env; server-function logging off
tools/developer/dev-local.mjs              NEW  one-command local stack with process supervision
tools/auth-emulator/src/server.ts          CHG  persistent state file, admin API, email hook
tests/e2e/organizations.spec.ts            NEW  8 scenarios (×2 viewports)
```

## 3. Database changes

- **Migrations are now in the repo.** `20260922162750_init` (54 models) and `20260922163656_organizations`.
  They are generated by Prisma's own schema engine, so `prisma migrate deploy` accepts them unchanged.
- `organizations.require_mfa boolean not null default false`.
- `invitations.accepted_by_id uuid`, `invitations.revoked_at timestamp(3)`.
- No new tables: `organizations`, `memberships`, `roles`, `role_permissions`, `invitations`,
  `audit_events` and `sequences` were already in the Phase 1 schema and are now actually used.
- Membership writes run inside `pg_advisory_xact_lock(hashtext('org-members:<id>'))`.

**Migrating without engine downloads:** `pnpm db:migrate:wasm --name <change>` diffs the schema against
`prisma/migrations/schema.snapshot.prisma` and writes a migration; `pnpm db:deploy:wasm` applies pending
migrations and keeps `_prisma_migrations` compatible with the Prisma CLI. CI still uses the CLI and fails
the build if the schema and migrations drift apart.

## 4. API design

| Route                     | Kind          | Behavior                                                         |
| ------------------------- | ------------- | ---------------------------------------------------------------- |
| `/app`                    | page          | Redirects to the last workspace, the first one, or `/onboarding` |
| `/onboarding`             | page          | Create a workspace (`?new=1` to add another)                     |
| `/invite/<token>`         | page (public) | Invitation state, sign-in/sign-up prompts, or the accept button  |
| `/<org>/dashboard`        | page          | Welcome, counts, getting-started checklist                       |
| `/<org>/settings`         | page          | Workspace details + security policy                              |
| `/<org>/settings/members` | page          | Members, roles, invitations, leave workspace                     |
| `/<org>/<module>/…`       | page          | Placeholder with the phase that delivers it                      |

Server actions (`features/organizations/actions.ts`): `checkSlugAvailability`, `createOrganization`,
`updateOrganization`, `updateSecurityPolicy`, `inviteMember`, `resendInvitation`, `revokeInvitation`,
`acceptInvitation`, `changeMemberRole`, `suspendMember`, `reactivateMember`, `removeMember`,
`leaveOrganization`. Each one re-resolves the workspace from the slug, checks a permission, validates with
Zod, and returns the shared `ActionResult`.

New rate limits: workspace creation 5/hour per user, invitations 50/hour, invitation accepts 10/10 min.

## 5. Components

| Component                                                 | Notes                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `CreateOrganizationForm`                                  | Name → address suggestion, debounced availability, currency/time-zone pickers |
| `MembersManager`                                          | Roster, inline role select, suspend/reactivate/remove, invitations, link copy |
| `OrganizationSettingsForm`                                | Name, legal name, tax id, currency, time zone, locale (read-only for members) |
| `SecuritySettings`                                        | "Require two-factor authentication" switch with rollback on refusal           |
| `AcceptInvitation`, `MfaRequiredNotice`, `LeaveWorkspace` | Focused client components with safe errors                                    |
| `NativeSelect` (UI package)                               | Native `<select>` for long lists: type-ahead, mobile pickers, no JS           |

Option lists (currencies, time zones, locales) are rendered from the server so hydration matches; the
browser's own time zone is applied after mount.

## 6. Server actions

Same five steps as Phase 3 — validate → rate-limit → authorize → persist (+audit) → safe result — with
authorization now coming from `requireOrgContext(slug, "platform.members.manage")` and friends. Denials
from the membership policy surface as plain sentences ("Every workspace needs at least one active owner").

## 7. Prisma models

No new models. `Organization` gains `requireMfa`; `Invitation` gains `acceptedById` and `revokedAt`.
`Membership`, `Role`, `RolePermission`, `Invitation`, `Sequence` and `AuditEvent` are now exercised by the
platform repositories, with `provisionRolesAndSequences()` shared between the app and the seed.

## 8. UI

- The Phase 2 app shell now runs on real data: organization switcher, permission-filtered navigation,
  breadcrumbs, command palette and the working user menu.
- `/onboarding`, `/invite/…` and `/account` share a light standalone layout (logo, workspace/account links).
- Dashboard: active members, pending invitations, your role, a getting-started checklist and the roadmap.
- Axe reports no serious or critical issues on onboarding, the dashboard or the MFA gate, light and dark,
  desktop and mobile.

## 9. Validation

| Input            | Rule                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Workspace name   | 2–80 characters                                                                             |
| Address (slug)   | 3–40 chars, `a-z0-9-`, no leading/trailing/double hyphen, not one of 40 reserved words      |
| Currency         | ISO 4217 from a curated list                                                                |
| Time zone        | Accepted by `Intl.DateTimeFormat` (or `UTC`)                                                |
| Locale           | One of the supported locales                                                                |
| Invite email     | Trimmed, lower-cased, valid address; not already a member                                   |
| Role key         | `^[a-z][a-z0-9_]{1,39}$`, must exist in this workspace; `owner` only assignable by an owner |
| Invitation token | 43 chars base64url; compared by SHA-256; single use, 7-day expiry, email-bound              |

## 10. Tests

| Suite                         | Result                   | Change                                        |
| ----------------------------- | ------------------------ | --------------------------------------------- |
| Unit / component (9 packages) | **205 passing**          | +27 (org rules, contracts, forms, emulator)   |
| Integration on PostgreSQL     | **21 passing**           | +6: new `platform.test.ts` on real migrations |
| E2E + axe (desktop + mobile)  | **96 passed, 8 skipped** | +8 organization scenarios per viewport        |

The platform suite covers provisioning, isolation from non-members and suspended members, the full
invitation lifecycle, owner-only role grants, last-owner protection under concurrent demotions, and the
audit trail. The e2e suite covers onboarding, reserved/taken addresses, invite → accept → role change →
suspend → remove, wrong-account invitations, workspace isolation (404), settings, the switcher, the
last-workspace memory and the workspace MFA policy.

## 11. Commands

```bash
pnpm dev:local                      # database + auth emulator + migrations + seed + app (Ctrl-C stops)
pnpm dev:local --reset              # same, wiping local auth accounts

pnpm db:migrate --name <change>     # Prisma CLI (needs engine downloads)
pnpm db:migrate:wasm --name <change> # same result without them
pnpm db:deploy / pnpm db:deploy:wasm
pnpm db:sql                         # Supabase SQL (RLS, storage, auth) — Node, no psql
pnpm db:seed

pnpm check                          # typecheck · lint · unit tests · formatting
TEST_DATABASE_URL=postgresql://… pnpm test:integration
pnpm test:e2e                       # starts the emulator + app; needs E2E_DATABASE_URL
```

## 12. Verification checklist

- [x] Sign-in resolves to the last workspace, the first, or onboarding
- [x] Workspace creation provisions 11 roles, 10 sequences, an owner membership and an audit row
- [x] Reserved and taken addresses are refused, with a suggestion
- [x] Invitations: hashed, single-use, 7-day expiry, email-bound, revocable, reissuable
- [x] Roles, suspension and removal enforce the membership policy (last owner, owner-only, no self-edits)
- [x] Non-members and suspended members get 404 — no existence leak
- [x] Workspace MFA policy enforced in the layout, in actions and by RLS; can't be switched on without MFA
- [x] Every workspace change writes an audit event in the same transaction
- [x] Real migrations committed; `pnpm db:deploy` and the WASM path both apply them; CI checks for drift
- [x] `pnpm dev:local` brings up the whole stack on a clean machine and restarts crashed processes
- [x] `pnpm check` (28 tasks + Prettier), integration (21) and e2e (96) green; `pnpm audit` clean
- [ ] Configure an email provider so invitations are delivered without copying links (Phase 5)

## Next: Phase 5 (Platform), for approval

- Custom roles and permission editing on top of the seeded templates.
- Audit log UI with filters, plus retention jobs (`app.purge_auth_data`).
- Notifications and the inbox; the background worker (outbox → email/webhooks).
- A real email transport for invitations and notifications.
- API keys and webhooks for the tenant.
