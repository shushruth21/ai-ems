# Runbook: restore the database

1. Supabase → Database → Backups → **Restore to a new project** (PITR timestamp).
2. Run `infrastructure/scripts/apply-supabase-sql.sh` against the new project. The scripts are idempotent.
3. Verify:
   - `pnpm --filter @ai-ems/db exec prisma migrate status`
   - Row counts against the incident timeline
   - `TEST_DATABASE_URL=… pnpm test:integration` on a scratch database created in the new project
4. Update `DATABASE_URL` / `DIRECT_URL` in Vercel and GitHub, then redeploy.
5. Keep the old project read-only for 7 days, for forensics.
