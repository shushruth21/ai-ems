# Disaster recovery

| Asset       | Backup                                                                         | RPO                | RTO                     |
| ----------- | ------------------------------------------------------------------------------ | ------------------ | ----------------------- |
| Postgres    | Supabase daily backups + point-in-time recovery (Pro add-on)                   | ≤ 5 minutes (PITR) | ≤ 1 hour                |
| Storage     | Supabase Storage replication; weekly export to a separate bucket or account    | ≤ 7 days           | ≤ 4 hours               |
| Application | Git + container images in GHCR with provenance                                 | 0                  | ≤ 15 minutes (redeploy) |
| Secrets     | Vercel and GitHub environments; offline sealed copy of break-glass credentials | —                  | ≤ 30 minutes            |

## Scenarios

1. **Bad deploy:** Vercel instant rollback, then forward-fix.
2. **Bad migration:**
   - Restore to a new project from PITR at T−1.
   - Replay safe writes from `audit_events`.
   - Switch `DATABASE_URL`.
3. **Region outage:**
   - Restore the latest backup into another region.
   - Update environment variables.
   - Redeploy.
4. **Compromised credentials:** follow [runbooks/rotate-secrets.md](runbooks/rotate-secrets.md).

## Testing

- **Quarterly:** restore drill into a scratch project. Run `pnpm test:integration` and the seed against it, then record the timings here.
