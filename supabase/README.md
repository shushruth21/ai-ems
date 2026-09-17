# supabase/

| Path               | Purpose                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------- |
| `config.toml`      | Supabase CLI settings for local development; mirror the `[auth]` values in hosted projects. |
| `migrations/*.sql` | Idempotent SQL applied after Prisma: RLS, storage, triggers, MFA enforcement.               |
| `templates/*.html` | Auth email templates. Links point to `/auth/confirm` with a token hash (see below).         |
| `tests/*.sql`      | Stand-ins for Supabase objects so migrations can be tested on plain PostgreSQL.             |

## Email links

All templates use:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<type>&next={{ .RedirectTo }}
```

`/auth/confirm` shows a single "Continue" button, and the token is verified only when it is pressed (a
server action). Mail security scanners that pre-fetch links therefore can't use up the token. `next` may
be an absolute URL; the app accepts it only if it is on its own origin.

Hosted projects: paste the templates into **Authentication → Emails** and set **Site URL** and
**Redirect URLs** (`https://<app-domain>/**`).
