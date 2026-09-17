# Incident response

## Severity

| Sev  | Definition                                              | Response                                                                              |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| SEV1 | Outage, data exposure or data loss affecting any tenant | Page immediately. Incident commander assigned. Status page updated within 15 minutes. |
| SEV2 | A major feature is degraded for many tenants            | Page during business hours. Status page updated.                                      |
| SEV3 | Minor degradation or a single-tenant issue              | Ticket, fixed within the sprint                                                       |

## Roles

- **Incident commander (IC):** coordinates the response and makes the calls.
- **Operations:** investigates and applies fixes.
- **Communications:** updates the status page and customers.
- **Scribe:** keeps the timeline.

## Process

1. **Declare.** Create an incident channel and assign the IC.
2. **Stabilise.** Roll back first (Vercel instant rollback). Disable the feature flag. If data is at risk, put the database into read-only mode.
3. **Security incident?** Rotate keys ([runbooks/rotate-secrets.md](runbooks/rotate-secrets.md)), preserve logs, involve legal, and notify affected tenants as their contract and the law require (e.g. within 72 hours under GDPR).
4. **Resolve.** Verify with health checks and SLO dashboards.
5. **Postmortem within 5 business days.** It must be blameless and cover the timeline, root cause, what went well, and action items with owners.
