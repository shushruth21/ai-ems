# Runbook: rotate secrets

| Secret                | Where                          | Rotation                                                                             |
| --------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API keys | Create a new secret key, update Vercel and GitHub, redeploy, then revoke the old key |
| Database password     | Supabase → Database            | Reset, update `DATABASE_URL` / `DIRECT_URL` everywhere, redeploy                     |
| `ANTHROPIC_API_KEY`   | Provider console               | Create a new key, update, redeploy, revoke the old key                               |
| `VERCEL_TOKEN`        | Vercel → Account tokens        | Create a new token, update the GitHub secret, delete the old token                   |
| Tenant API keys       | App (Phase 5)                  | Tenants rotate them themselves. Admins can revoke.                                   |

After rotating:

1. Check `/api/health?deep=1`.
2. Watch error rates for 30 minutes.
3. Record the rotation in the compliance evidence log.
