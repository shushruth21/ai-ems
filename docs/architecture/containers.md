# Containers (C4 level 2)

```mermaid
flowchart TB
  browser["Browser<br/>React 19 · TanStack Query"]
  subgraph vercel["Vercel"]
    proxy["proxy.ts<br/>session refresh · auth/MFA gate · CSP nonce"]
    web["apps/web (Next.js 16)<br/>RSC pages · server actions · route handlers"]
  end
  worker["apps/worker (Phase 5)<br/>outbox processor · schedules · notifications"]
  ai["services/ai-service (Phase 21, Python)<br/>copilot orchestration · RAG · forecasting"]
  ingest["services/ingestion-service (Phase 20, Python)<br/>extract · redact · chunk · embed"]
  subgraph supabase["Supabase"]
    auth["Auth (GoTrue)"]
    pg[("Postgres<br/>RLS · sequences · outbox · pgvector")]
    storage[("Storage<br/>private buckets")]
    realtime["Realtime"]
  end
  llm["LLM provider"]

  browser --> proxy --> web
  browser <-. websocket .-> realtime
  web -->|Prisma, pooled| pg
  web --> auth
  web -->|signed URLs| storage
  worker --> pg
  worker --> ai
  web -->|HTTPS, service token| ai
  ai --> pg
  ai --> llm
  ingest --> storage
  ingest --> pg
  realtime --> pg
```

| Container             | Technology                          | Scales by                    | State                                 |
| --------------------- | ----------------------------------- | ---------------------------- | ------------------------------------- |
| `apps/web`            | Next.js 16 on Vercel (Node runtime) | Serverless concurrency       | Stateless                             |
| `apps/worker`         | Node, Vercel Cron or a container    | Queue depth                  | Stateless (the outbox is in Postgres) |
| `services/ai-service` | Python 3.12, FastAPI, uv            | Container replicas           | Stateless                             |
| Postgres              | Supabase (Pro), Supavisor pooling   | Vertical, then read replicas | System of record                      |
| Storage               | Supabase Storage (S3-compatible)    | Managed                      | Files                                 |

Only `apps/web` exists today. The other containers are listed with the phase that introduces them.
