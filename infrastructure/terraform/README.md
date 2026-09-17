# terraform/ (Phase 24)

Planned modules (providers `supabase/supabase`, `vercel/vercel`, `cloudflare/cloudflare`):

```
terraform/
├── modules/{supabase-project, vercel-project, dns, rate-limit-store}
└── environments/{staging, production}   remote state, per-environment variables
```

Until then, environments are configured in the Supabase and Vercel dashboards, following `config/environments/*.env.example`.
