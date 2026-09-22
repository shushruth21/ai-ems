# 0008. Workspace routing, membership resolution and invitations

- **Status:** accepted
- **Date:** 2026-09-22

## Context

Phase 4 turns the single-user app into a multi-tenant one: a person can belong to several workspaces,
with a different role in each. Every page and action now needs to answer "which workspace, and may this
person do this here?" — cheaply, and without leaking which workspaces exist.

## Decision

1. **Path-based tenancy: `/<slug>/…`.** The slug is short, shareable and visible in the address bar, and
   it needs no extra DNS or TLS work (subdomains can be added later without changing the data model).
   `packages/domain/organization/slug.ts` owns the format and the reserved-word list, so the app can
   never hand out a slug that would shadow `/login`, `/account`, `/api`, …
2. **One resolver per request.** `getOrgContext(slug)` (React `cache`) loads the membership, role,
   permissions, the user's other workspaces and a tenant-scoped Prisma client. Server actions call
   `requireOrgContext(slug, ...permissions)`, which re-resolves from the slug the client sent — a client
   can never pick its own organization id.
3. **Non-members get 404, not 403.** Existence of a workspace is not disclosed. Suspended members are
   treated exactly like non-members.
4. **`/app` is the landing page.** It opens the last workspace (a `ai_ems_org` cookie set by `proxy.ts`,
   and by the actions that redirect into a workspace), else the first, else `/onboarding`. Sign-in
   therefore never needs to know about workspaces.
5. **Membership rules are pure functions** (`packages/domain/organization/membership-policy.ts`):
   last-active-owner protection, "only owners grant the owner role", and no acting on your own
   membership. Repositories enforce them inside a transaction that takes a Postgres advisory lock per
   organization, so two concurrent demotions can't both pass the last-owner check.
6. **Invitations are app-owned, not Supabase-owned.** A 32-byte token is emailed; only its SHA-256 is
   stored. Links are single-use, expire in 7 days, are bound to the invited address, and re-inviting
   revokes the previous link. Accepting requires a signed-in session whose email matches — so an
   intercepted link alone is not enough. When no email transport is configured the inviter gets a
   copyable link instead, which keeps the product usable before an email provider is wired up (Phase 5).
7. **Per-workspace MFA policy.** `organizations.require_mfa` is enforced in three places, like Phase 3's
   personal MFA: the workspace layout shows a gate, `requireOrgContext` refuses, and the RLS policy
   `app.mfa_satisfied()` already hides tenant rows from aal1 sessions. An administrator can't switch it on
   from a session that hasn't itself completed MFA (no lock-outs).
8. **Audit from day one.** Workspace, member and invitation changes write `audit_events` rows inside the
   same transaction as the change, through the repository layer rather than the UI.

## Consequences

- Pages read from `prisma` for platform tables and from `ctx.db` (tenant-scoped) for business data; the
  tenant guard and RLS stay the safety net for the modules that follow.
- Slugs are permanent for now. Renaming needs redirects and a link-rot story; deferred.
- The advisory lock serializes membership writes per organization — fine at human scale, revisit for bulk
  imports.
- Role _templates_ are seeded per workspace (`SYSTEM_ROLES`); custom roles and per-role editing arrive in
  Phase 5, which is why `listRoles` already returns permission counts.

## Alternatives considered

- **Subdomain tenancy** (`acme.ai-ems.app`): nicer branding, but wildcard TLS, cookie scoping and local
  development friction, for no gain at this stage.
- **Organization id in a cookie only** (no path segment): breaks shareable links and makes "open two
  workspaces in two tabs" impossible.
- **Supabase invitations** (`auth.admin.inviteUserByEmail`): ties workspace membership to account
  creation, can't express roles, and behaves differently for existing users.
