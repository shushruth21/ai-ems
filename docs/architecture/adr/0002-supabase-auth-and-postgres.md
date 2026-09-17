# 0002. Supabase for Auth, Postgres, Storage and Realtime

- **Status:** accepted
- **Date:** 2026-09-17

## Context

We need production-grade auth (MFA, OAuth, email flows), managed Postgres with row-level security, file storage and change feeds, and a small operations burden.

## Decision

Use Supabase:

- Use the new **publishable and secret keys**.
- Verify identity with `auth.getClaims()`, which checks the JWT signature.
- Refresh sessions in `proxy.ts`.
- We don't issue our own JWTs. Supabase is the identity provider.

## Consequences

- Most auth features come built in.
- RLS is available for defense in depth.
- There is some vendor coupling. It's mitigated by standard Postgres and S3-compatible storage.
- Email templates and redirect allow-lists live in `supabase/config.toml` and the dashboard.

## Alternatives considered

- **Custom JWT with NextAuth/Auth.js:** more code to own, including MFA.
- **Clerk:** strong, but auth data would live outside our database.
