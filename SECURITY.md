# Security policy

## Reporting a vulnerability

Please **do not** open a public issue.

- **How to report:** use GitHub's private vulnerability reporting (_Security → Report a vulnerability_) or email the maintainers.
- **What to include:** affected version or commit, steps to reproduce, and impact.
- **Our response:** we acknowledge within **2 business days** and aim to fix critical issues within **7 days**.

## Supported versions

Only the latest release on `main` receives security fixes during the pre-1.0 period.

## Security model (summary)

| Control               | Implementation                                                                                                                           |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication        | Supabase Auth. JWTs are signature-verified with `getClaims()`. MFA (TOTP) is supported.                                                  |
| Authorization         | Permission catalog plus per-tenant roles (`packages/security`). Every server action calls `authorize()`.                                 |
| Tenant isolation      | `getTenantDb()` enforces `organizationId` on every query, and Postgres RLS protects every client-reachable path (`supabase/migrations`). |
| Transport and browser | HSTS, per-request nonce CSP, `frame-ancestors 'none'`, strict referrer and permissions policies.                                         |
| Secrets               | Validated at boot. The service key is server-only and never shipped to the browser.                                                      |
| Audit                 | Append-only `audit_events` and `stock_movements`, enforced by database triggers.                                                         |
| Supply chain          | Lockfile installs, Dependabot, `pnpm audit`, CodeQL, gitleaks, Trivy, signed build provenance.                                           |

More detail: `docs/architecture/threat-model.md`.
