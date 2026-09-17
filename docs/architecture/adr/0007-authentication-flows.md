# 0007. Authentication flows, MFA and rate limiting

- **Status:** accepted
- **Date:** 2026-09-17

## Context

Phase 3 adds sign-in to a multi-tenant ERP whose administrators can see prices, margins and payroll. We need
password, passwordless and SSO sign-in, a second factor, and defences against credential stuffing and account
enumeration. Supabase Auth (ADR 0002) is the identity provider. The app runs as serverless functions, so
in-process state is not shared between requests.

## Decision

1. **Server-only auth calls.** Every flow is a server action or route handler using the cookie-bound Supabase
   server client (PKCE flow). The browser never calls Supabase Auth directly, and no tokens reach client JavaScript.
2. **Shared contracts.** Input schemas and the password policy live in `@ai-ems/contracts`. The browser uses them
   for instant feedback and the server re-validates. The policy follows NIST SP 800-63B: at least 12 characters,
   deny-lists, no composition rules.
3. **Email links go through a confirm page.** Templates link to `/auth/confirm?token_hash=…`. The token is verified
   by a server action only after the user presses a button, so mail scanners that pre-fetch URLs can't consume it.
   `next` may be absolute (`{{ .RedirectTo }}`) but must be on the app's origin.
4. **MFA (TOTP) is enforced in three layers:**
   - `proxy.ts` sends aal1 sessions of users with a verified factor to `/login/mfa`. This is a UX gate that uses the
     cookie's factor list.
   - `requireSession()` asks the Auth server for the user (`getUser`), so the factor list can't be spoofed through
     the cookie.
   - A restrictive RLS policy (`app.mfa_satisfied()`) hides tenant rows from such sessions in Postgres.
     Removing a factor requires an aal2 session.
5. **Rate limiting** is fixed-window and counted per IP _and_ per identity (HMAC of the email, or the user id).
   - Store: Postgres (`rate_limit_buckets`, one atomic upsert per hit) in production; in-memory in development.
   - Limits are defined per action in `AUTH_RATE_LIMITS`.
   - If the store fails, requests are allowed and the failure is logged, because Supabase's own limits still apply.
6. **No account enumeration.** Sign-in errors are uniform. Magic link, reset and sign-up return the same response
   whether or not the account exists.
7. **Security events.** `auth_events` is global (auth happens before an org is chosen) and append-only except for
   retention purges. Emails are stored only as an HMAC (`AUTH_IDENTITY_SECRET`). Users can read their own events
   (RLS), and the account page shows them. Writes never block sign-in.
8. **Revoked sessions** (e.g. after "sign out of all devices") are detected in `requireSession()`. The app then
   routes through `/auth/session-expired`, which clears cookies only after the Auth server confirms the session is
   gone. An Auth outage never signs users out.
9. **Testing against a GoTrue emulator.** `tools/auth-emulator` implements the subset of the Auth HTTP API we use:
   ES256 JWKS, PKCE, TOTP, email token hashes and API-version error codes. E2E tests therefore exercise the real
   `@supabase/ssr` and `supabase-js` code, cookies and JWT verification without network access.

## Consequences

- Positive: every flow works without client-side Supabase and degrades gracefully without JavaScript (OAuth, sign-out).
- The emulator must follow Supabase API changes. Its own test suite drives it with the pinned `supabase-js`, so drift
  shows up in CI.
- `requireSession()` makes one extra Auth request per protected render. `React.cache` memoizes it per request.
- Default landing page is `/account` until organizations arrive (Phase 4).
- Follow-ups:
  - WebAuthn/passkeys, recovery codes and admin-enforced MFA per organization (Phase 4/5).
  - CAPTCHA on sign-up if abuse appears.
  - Scheduling `app.purge_auth_data()` (Phase 5 worker).

## Alternatives considered

- **Client-side Supabase Auth UI.** Rejected: tokens in JS, harder CSP, and no server-side rate limits or audit.
- **Redis/Upstash for rate limits.** Rejected for now: another vendor, while Postgres is already there. The store
  interface allows swapping it later.
- **Direct `GET /auth/confirm` route handler.** Rejected: link scanners burn one-time tokens.
- **Mocking Supabase in e2e.** Rejected: it would bypass the cookie/JWT code paths that matter most.
