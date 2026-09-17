# Compliance evidence map (SOC 2-oriented)

| Control area             | Evidence in this repo / system                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Change management        | Pull requests with required review (CODEOWNERS), CI checks, Conventional Commits, protected `production` environment |
| Access control           | Permission catalog and role templates (`packages/security`), RLS policies with tests, TOTP MFA enforced (app + RLS)  |
| Logical security         | Nonce CSP and security headers (e2e-tested), secrets validation, gitleaks                                            |
| Vulnerability management | Dependabot, `pnpm audit`, CodeQL, Trivy (filesystem and image), SARIF uploads                                        |
| Audit logging            | Append-only `audit_events` (trigger-enforced); `auth_events` security log shown to each user                         |
| Availability             | SLOs, health checks, DR plan with quarterly restore drills                                                           |
| Incident response        | `docs/operations/incident-response.md`, postmortems                                                                  |
| Data protection          | Classification and retention policies, tenant isolation invariants                                                   |
| Supply chain             | Lockfile installs, build provenance attestations, SBOM in the container build                                        |

## Evidence log

| Date       | Control          | Evidence                                                                             | By  |
| ---------- | ---------------- | ------------------------------------------------------------------------------------ | --- |
| 2026-09-17 | Tenant isolation | RLS integration suite: 9 tests passing on PostgreSQL                                 | —   |
| 2026-09-17 | Tenant isolation | RLS integration suite: 15 tests (incl. MFA restrictive policy, auth tables)          | —   |
| 2026-09-17 | Authentication   | E2E: sign-up, links, reset, MFA, OAuth PKCE, rate limits, global sign-out (emulator) | —   |
