# Threat model (STRIDE)

**Scope:** `apps/web`, Supabase (Auth, Postgres, Storage), CI/CD. Reviewed at the end of every phase.

| #   | Threat                                          | Component                | Mitigation                                                                                  | Status                          |
| --- | ----------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------- |
| S1  | Session theft or forged JWT                     | proxy, server            | `getClaims()` signature verification, httpOnly SameSite cookies, HSTS                       | Done                            |
| S2  | Credential stuffing or brute force              | Auth                     | Supabase rate limits, app-level limits on auth actions, MFA (TOTP)                          | Done                            |
| S4  | MFA bypass by editing the session cookie        | proxy, server, DB        | Server re-checks factors with Auth; restrictive RLS `app.mfa_satisfied()`                   | Done                            |
| S5  | One-time email links consumed by mail scanners  | Auth email               | Confirm page verifies only on explicit POST                                                 | Done                            |
| S6  | Revoked session keeps working until JWT expiry  | server                   | `getUser()` in `requireSession()`; `/auth/session-expired` clears cookies                   | Done                            |
| S3  | OAuth open redirect                             | Auth callback            | `safeRedirectPath()` allows same-origin relative paths only                                 | Done                            |
| T1  | Cross-tenant data modification                  | server actions           | `getTenantDb()` guard, RLS denies client writes                                             | Done                            |
| T2  | Tampering with price or discount in the browser | Sales                    | Server-side pricing (`priceLine`), discount policy check                                    | Done (domain), wired in Phase 9 |
| T3  | Ledger or audit tampering                       | DB                       | Append-only triggers                                                                        | Done                            |
| R1  | Actions not attributable                        | All writes               | `audit_events` with actor, IP, user agent, before/after                                     | Phase 5                         |
| R2  | Security events not attributable                | Auth                     | Append-only `auth_events` (IP, user agent, HMAC identity), visible to the user              | Done                            |
| S7  | Invitation link intercepted or shared           | invitations              | Hashed single-use token, 7-day expiry, bound to the invited email, sign-in required         | Done                            |
| E5  | Privilege escalation by editing your own role   | members                  | Pure membership policy: no self-edits, owner-only owner grants, last-owner protection       | Done                            |
| E6  | Workspace left without an owner                 | members                  | Advisory-locked transaction re-checks the active owner count                                | Done                            |
| I1  | Cross-tenant data read                          | reads, Realtime, Storage | Tenant client, RLS on every tenant table, org-prefixed storage policy                       | Done                            |
| I2  | XSS leading to token or data exfiltration       | web                      | React escaping, nonce CSP (`strict-dynamic`), no `dangerouslySetInnerHTML`                  | Done                            |
| I7  | Workspace existence disclosure                  | /[org] routes            | Non-members and suspended members get 404, never 403                                        | Done                            |
| I6  | Account enumeration                             | Auth                     | Uniform errors and responses for sign-in, sign-up, magic link, reset                        | Done                            |
| I3  | Secrets in the client bundle                    | build                    | Server-only env module, `server-only` imports, gitleaks in CI                               | Done                            |
| I4  | PII sent to the LLM                             | AI                       | Minimisation, redaction, per-tenant opt-out                                                 | Phase 21                        |
| I5  | Prompt injection via documents                  | RAG                      | Content isolation, tool allow-lists, output schema validation, proposals only               | Phase 21                        |
| D1  | Request floods                                  | edge, auth               | Vercel protections, rate limits, pagination limits                                          | Auth done; rest Phase 22        |
| D2  | Expensive AI usage                              | AI                       | Budgets per plan, per-user rate limits                                                      | Phase 21                        |
| E1  | Privilege escalation via role edits             | Platform                 | `platform.roles.manage` required, owner role protected, audit                               | Phase 5                         |
| E2  | Service-role key misuse                         | server                   | Used only in explicit admin paths, never in request handlers for tenant data                | Done                            |
| E3  | Clickjacking                                    | web                      | `frame-ancestors 'none'`, `X-Frame-Options: DENY`                                           | Done                            |
| E4  | Compromised dependency or CI                    | supply chain             | Lockfile, Dependabot, audit, CodeQL, Trivy, provenance attestations, protected environments | Done                            |
