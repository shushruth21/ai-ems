# Phase 3 — Authentication

**Status:** complete, waiting for approval before Phase 4 (Organization & multi-tenancy).
**Builds on:** Phase 2.5 monorepo (`6080976`). Earlier work was not redesigned. Changes to existing files are listed in §2.
**Decision record:** [ADR 0007](../architecture/adr/0007-authentication-flows.md).

## 1. Architecture

```
Browser ──form/server action──▶ apps/web (Next.js 16)
                                  │ proxy.ts: CSP nonce → updateSession() → decideRoute()
                                  │   anonymous → /login?next=…   aal1 + factor → /login/mfa?next=…
                                  │
                                  ├─ features/auth/actions.ts ("use server")
                                  │    Zod contract → rate limit (IP + identity) → Supabase Auth → auth_events → redirect / safe error
                                  ├─ server/auth/session.ts  requireSession(): getClaims() + getUser() (authoritative factors)
                                  ├─ app/auth/callback        OAuth PKCE code exchange
                                  ├─ app/(auth)/auth/confirm  email links: page + POST-only verification
                                  └─ app/auth/session-expired clears revoked sessions
                                          │
             ┌────────────────────────────┼─────────────────────────────┐
             ▼                            ▼                             ▼
     Supabase Auth (GoTrue)     Postgres: auth_events,          RLS: app.mfa_satisfied()
     ES256 JWT, TOTP, PKCE      rate_limit_buckets              restrictive policy on tenant data
```

| Concern         | Where                                                           | Notes                                                              |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Input contracts | `packages/contracts` (new)                                      | Shared by forms and actions; password policy (NIST 800-63B)        |
| Auth primitives | `packages/security/src/authentication/*`                        | Rate limiter, error mapping, AAL, HMAC identity, redirect builders |
| Persistence     | `packages/db/src/auth/*`, `prisma/schema/auth.prisma`           | Postgres rate-limit store (atomic upsert), audit repository        |
| Enforcement     | `proxy.ts` (UX) → `requireSession()` (authoritative) → RLS (DB) | Three layers for MFA                                               |
| Testing         | `tools/auth-emulator` (new)                                     | GoTrue-compatible emulator driving real `supabase-js` in e2e       |

**Key properties**

- No auth call runs in the browser, and no token is readable by JavaScript.
- Responses never reveal whether an account exists: sign-in, magic link, reset and sign-up all look the same.
- Email-link tokens are verified only by an explicit POST from `/auth/confirm`, so mail scanners can't consume them.
- An Auth outage never signs anyone out. A revoked session is cleared only after Auth confirms it is gone.
- The default post-login page is `/account`. Organization home arrives in Phase 4.

## 2. Folder structure (added or changed in this phase)

```
packages/contracts/                      NEW  @ai-ems/contracts
  src/auth.ts                                 sign-in/up, magic link, reset, change, MFA, confirm-link schemas; ActionResult
  src/password-policy.ts                      assessPassword(): length, deny-list, repetition, context words, strength
packages/security/src/authentication/
  rate-limit.ts                          NEW  RateLimiter, MemoryRateLimitStore, AUTH_RATE_LIMITS, authRateLimitKeys
  errors.ts                              NEW  toSafeAuthError(): Supabase codes → safe messages
  aal.ts · identity.ts · redirects.ts    NEW  needsMfa(), hashIdentity() (HMAC), callback URL builders
  session-errors.ts                      NEW  isSessionGone(): revoked vs. outage
  supabase/proxy.ts                      CHG  updateSession() also returns mfaRequired
packages/config/src/env.ts               CHG  AUTH_RATE_LIMIT_{STORE,ENABLED}, AUTH_IDENTITY_SECRET, TRUSTED_IP_HEADER, authSettings()
packages/db/
  prisma/schema/auth.prisma              NEW  AuthEvent, RateLimitBucket, AuthEventType
  src/auth/auth-events.ts                NEW  recordAuthEvent(), listRecentAuthEvents()
  src/auth/rate-limit-store.ts           NEW  PostgresRateLimitStore
  src/tenant-scope.ts                    CHG  both models are global
  tests/integration/rls.test.ts          CHG  +6 tests (15 total)
packages/ui/src/lib/initials.ts          NEW  initialsOf moved out of a client module (server-safe)
supabase/
  migrations/0003_auth.sql               NEW  MFA restrictive RLS, auth_events RLS, bucket lockdown, purge function
  config.toml · templates/*.html · README NEW local Auth config, email templates → /auth/confirm
  tests/*.sql                            CHG  auth.jwt(), auth.mfa_factors, auth tables
tools/auth-emulator/                     NEW  GoTrue emulator (+ supabase-js-driven tests)
apps/web/src/
  proxy.ts · lib/routes.ts               CHG  decideRoute() (pure), MFA gate, safe `next` with query strings
  server/auth/{session,audit,rate-limit,request-meta,app-url}.ts  NEW
  server/redirect.ts                     NEW  typed redirect for validated runtime paths
  features/auth/actions.ts               NEW  15 server actions
  features/auth/components/*             NEW  forms, password meter, OTP input, MFA settings, activity list
  app/(auth)/{login,login/mfa,signup,forgot-password,reset-password,verify-email,auth/confirm}  NEW
  app/auth/{callback,session-expired}/route.ts  NEW
  app/account/{layout,page}.tsx          NEW  profile, password, MFA, sessions, security activity
  app/legal/{terms,privacy}              NEW  operator placeholders (linked from sign-up)
  app/page.tsx · components/layout/user-menu.tsx  CHG  sign-in links; working "Sign out"
tests/e2e/auth.spec.ts · support/auth.ts NEW  22 auth scenarios (×2 viewports)
playwright.config.ts · .github/workflows/ci.yml  CHG  emulator + Postgres in e2e
turbo.json                               CHG  tasks also wait for their own db:generate (race fix)
```

## 3. Database changes

- **Prisma** (`auth.prisma`):
  - `AuthEvent`: `id` bigint, `profileId` uuid?, `identityHash`, `type AuthEventType`, `ip`, `userAgent`, `metadata` jsonb, `createdAt`. Indexed by `(profileId, createdAt desc)`, `(identityHash, createdAt desc)` and `createdAt`.
  - `RateLimitBucket`: `key` pk, `count`, `windowStart`, `expiresAt` (indexed).
  - Both models are added to `GLOBAL_MODELS`, since they aren't tenant-owned.
- **`supabase/migrations/0003_auth.sql`** (idempotent, applied after `prisma migrate deploy`):
  - `app.mfa_satisfied()` returns true when the JWT's `aal` is aal2 or the user has no verified factor. It is applied as a `require_mfa` restrictive SELECT policy on every tenant table, `organizations` and `storage.objects`.
  - `auth_events`: RLS forced, users can read only their own rows, no client writes, updates are blocked by trigger. Deletes are allowed for retention.
  - `rate_limit_buckets`: RLS forced, privileges revoked from `authenticated` and `anon`.
  - `app.purge_auth_data(days default 365)` removes expired buckets and events older than the retention period (1 year, per the retention policy).
- **Migration file:** generate on a machine with Prisma engines (`pnpm db:migrate --name auth`). The sandbox blocks engine downloads, so CI uses `prisma db push`.

## 4. API design

| Endpoint                    | Kind                       | Behavior                                                                                                                                                                                                                                                                                           |
| --------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /auth/callback`        | route handler              | PKCE `exchangeCodeForSession` (honors `sb_flow_id`) → `next`, MFA step, or `/login?error=…` (303)                                                                                                                                                                                                  |
| `GET /auth/confirm`         | page                       | Validates params and shows Continue. The POST server action runs `verifyOtp({ token_hash, type })`                                                                                                                                                                                                 |
| `GET /auth/session-expired` | route handler              | Local sign-out only if Auth confirms the session is gone                                                                                                                                                                                                                                           |
| Server actions              | `features/auth/actions.ts` | `signInWithPassword`, `requestMagicLink`, `startOAuth`, `signUp`, `confirmEmailLink`, `requestPasswordReset`, `completePasswordReset`, `changePassword`, `verifyMfa`, `startTotpEnrollment` / `confirmTotpEnrollment` / `cancelTotpEnrollment`, `removeTotpFactor`, `signOut`, `signOutEverywhere` |

All actions return `ActionResult` (`{ ok, message } | { ok: false, formError?, fieldErrors?, retryAfterSeconds? }`) or redirect. `docs/api/openapi.yaml` is updated.

**Rate limits** (`AUTH_RATE_LIMITS`, fixed window, per IP / per identity):

| Action          | per IP      | per identity |
| --------------- | ----------- | ------------ |
| sign-in         | 30 / 10 min | 10 / 10 min  |
| magic-link      | 10 / 10 min | 3 / 10 min   |
| sign-up         | 10 / h      | 3 / h        |
| password-reset  | 10 / h      | 3 / h        |
| mfa-verify      | 30 / 10 min | 8 / 10 min   |
| password-change | 20 / h      | 5 / h        |

## 5. Components

| Component                                                       | Notes                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `SignInForm`                                                    | "With password" / "With email link" tabs (the second is flag-gated)           |
| `OAuthButtons`                                                  | Plain forms; work before hydration; provider names only, no third-party logos |
| `SignUpForm`, `PasswordStrength`                                | Live strength meter using the same policy as the server                       |
| `PasswordInput`                                                 | Show/hide toggle (`aria-pressed`) that keeps focus in the field               |
| `OtpInput`                                                      | `inputMode=numeric`, `autocomplete=one-time-code`                             |
| `ForgotPasswordForm`, `ResetPasswordForm`, `ChangePasswordForm` | Shared `NewPasswordFields`; hidden username field for password managers       |
| `MfaChallengeForm`, `MfaSettings`                               | QR (data-URL SVG), copyable key, confirm, cancel, remove (requires aal2)      |
| `ConfirmLinkForm`                                               | Button-driven verification                                                    |
| `SessionActions`, `SecurityActivity`                            | Sign out / sign out everywhere; recent events (failures highlighted)          |
| `useActionForm`                                                 | Maps `ActionResult` onto React Hook Form fields plus a form-level alert       |

## 6. Server actions

Every action follows the same steps: **validate** (Zod contract) → **rate-limit** (`limitAuthAttempt`) → **Supabase Auth** (cookie-bound client) → **audit** (`auditAuthEvent`, never throws) → **redirect or safe error** (`toSafeAuthError`).

- Protected actions call `requireSession()` first.
- `changePassword` checks the current password with a throwaway, non-persisting client, then revokes that extra session.
- A password reset or change signs out the user's other sessions (`scope: "others"`).

## 7. Prisma models

`AuthEvent`, `RateLimitBucket` and enum `AuthEventType` (16 values), described in §3. The schema now has 54 models.

## 8. UI

- The `(auth)` layout is a centered card with the logo and legal links. Auth pages are `noindex`.
- `/account` has cards for Profile, Password, Two-factor authentication, Sessions and Recent security activity. It uses minimal chrome (logo and theme toggle) until the org shell is wired in Phase 4.
- The landing page has "Sign in" and "Create account". The app-shell user menu's "Sign out" works.
- Everything works in light and dark themes and on mobile. Axe finds no serious or critical issues on any auth page, `/account` or the MFA step.

## 9. Validation

| Input            | Rule                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Email            | trimmed, lower-cased, max 254 characters, valid format                                                                       |
| New password     | 12–128 characters; not common; not repetitive or sequential; no name or email parts; strength meter                          |
| Current password | required, max 128 characters (the policy applies only when setting a password)                                               |
| `next`           | same-origin relative path; no `//`, `\`, control characters or >2048 chars; normalized; absolute URLs only on the app origin |
| TOTP             | spaces stripped, exactly 6 digits                                                                                            |
| Token hash       | 16–512 chars of `[A-Za-z0-9_-]`; type in the `EmailOtpType` set                                                              |
| Client IP        | first hop of `TRUSTED_IP_HEADER`, character-checked                                                                          |

## 10. Tests

| Suite                                    | Count                                   | Covers                                                                                                                                                                                                                                                                             |
| ---------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit / component (Vitest, 8 packages)    | **178** (+62)                           | Contracts, rate limiter, error mapping, AAL, HMAC, routes/decideRoute, session mapping, all auth forms, emulator (TOTP RFC 6238 vectors; supabase-js flows)                                                                                                                        |
| RLS integration (PostgreSQL)             | **15** (+6)                             | MFA restrictive policy, auth_events ownership and immutability, bucket lockdown, atomic Postgres limiter (7 concurrent hits), purge                                                                                                                                                |
| E2E + axe (Playwright, desktop + mobile) | **88** (81 passed, 7 skipped by design) | 22 new auth scenarios (×2 viewports): sign-up → confirm, single-use links, magic link, reset, change password, TOTP enroll/challenge/remove, MFA gate, switching accounts, rate limit, enumeration safety, open redirect, OAuth PKCE, bad codes, global sign-out → session-expired |

The e2e run also confirmed that audit rows are written with HMAC identities only (no raw emails) and that rate-limit buckets live in Postgres.

## 11. Commands

```bash
pnpm install
pnpm db:generate
pnpm db:migrate --name auth                       # local machine with Prisma engines
make db-deploy                                    # prisma migrate deploy + supabase/migrations/*.sql (incl. 0003)
pnpm check                                        # typecheck · lint · unit tests · prettier
TEST_DATABASE_URL=postgresql://… pnpm test:integration
pnpm test:e2e                                     # starts the auth emulator + app; needs E2E_DATABASE_URL (see playwright.config.ts)

# Manual e2e against running servers:
pnpm --filter @ai-ems/auth-emulator start         # http://127.0.0.1:54321/auth/v1
PLAYWRIGHT_BASE_URL=http://localhost:3100 pnpm exec playwright test tests/e2e/auth.spec.ts
```

**Hosted Supabase setup:**

1. Set **Site URL** and **Redirect URLs** to `https://<app>/**`.
2. Paste `supabase/templates/*` into Authentication → Emails.
3. Enable TOTP MFA.
4. Enable Google and Azure providers, then set `FEATURE_OAUTH_*=true`.
5. Set `AUTH_IDENTITY_SECRET` (32+ random characters).

## 12. Verification checklist

- [x] Password, magic-link and OAuth (PKCE) sign-in; sign-up with email confirmation
- [x] Password reset (single-use link, other sessions signed out) and change (re-authenticates first)
- [x] TOTP MFA: enroll, challenge, remove (aal2 only); gate enforced in proxy, server and RLS
- [x] Rate limits per IP and identity, shared through Postgres; fails open with an error log
- [x] No account enumeration; safe error messages; no open redirects (including query strings)
- [x] Security events recorded with HMAC identity; users see their own activity
- [x] Revoked sessions detected and cleared without redirect loops; Auth outages don't sign users out
- [x] Email links immune to link-scanner prefetch
- [x] No client-side tokens; CSP unchanged; no `any`; secrets only from env
- [x] Axe clean (serious/critical) on all auth pages in light and dark, desktop and mobile
- [x] `pnpm check` (28 turbo tasks + Prettier), integration and e2e suites all green; `turbo prune` includes `@ai-ems/contracts`; `pnpm audit` clean
- [ ] Generate and commit the Prisma migration (`pnpm db:migrate --name auth`) on a machine with engines
- [ ] Configure hosted Supabase (URLs, templates, TOTP, providers) per §11

## Next: Phase 4 (Organization & multi-tenancy), for approval

- Onboarding: create an organization (slug, currency, time zone) and seed the owner role.
- Invitations using the `invite` template, membership states, and an organization switcher.
- `/[org]` shell mounted with server-resolved user, organization and permissions (the existing `AppShell`).
- `requireMembership()` and `authorize()` wired together, with a per-organization "require MFA" policy.
- The post-login default changes from `/account` to the last-used organization.
