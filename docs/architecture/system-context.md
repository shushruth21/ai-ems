# System context (C4 level 1)

```mermaid
flowchart LR
  subgraph People
    staff["Staff users<br/>(sales, planners, buyers, warehouse,<br/>inspectors, finance, admins)"]
    operator["Shop-floor operators<br/>(kiosk)"]
    partner["External partners<br/>(portal)"]
    integrator["Integrators<br/>(API keys)"]
  end

  aiems["AI EMS<br/>multi-tenant enterprise management platform"]

  subgraph External systems
    supabase["Supabase<br/>Auth · Postgres · Storage · Realtime"]
    llm["LLM provider<br/>(Anthropic by default)"]
    email["Email delivery<br/>(Supabase SMTP / provider)"]
    idp["Identity providers<br/>(Google, Microsoft)"]
    payments["Billing<br/>(Stripe, Phase 9 of SaaS)"]
    vercel["Vercel<br/>hosting & edge network"]
  end

  staff --> aiems
  operator --> aiems
  partner --> aiems
  integrator --> aiems
  aiems --> supabase
  aiems --> llm
  aiems --> email
  aiems --> idp
  aiems --> payments
  vercel -. hosts .- aiems
```

| Actor or system | Interaction                                                                        | Trust boundary           |
| --------------- | ---------------------------------------------------------------------------------- | ------------------------ |
| Staff users     | Browser. Session cookie from Supabase Auth, MFA optional per tenant.               | Internet → edge          |
| Operators       | Shared kiosk device, short sessions, limited permissions                           | Internet → edge          |
| Partners        | Separate portal routes, partner-scoped permissions                                 | Internet → edge          |
| Integrators     | REST `/api/v1` with hashed, scoped, revocable API keys                             | Internet → edge          |
| Supabase        | Pooled Postgres (Prisma), Auth, Storage (signed URLs), Realtime                    | Server → managed service |
| LLM provider    | Server-side only. Prompts are minimised and redacted, never sent from the browser. | Server → third party     |
