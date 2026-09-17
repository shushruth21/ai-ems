# Components (C4 level 3)

## apps/web

```mermaid
flowchart LR
  subgraph app["src/app (routes)"]
    pages["pages & layouts<br/>(server components)"]
    actions["server actions"]
    handlers["route handlers<br/>/api/health · /auth/*"]
  end
  subgraph features["src/features/<module>"]
    fui["module UI"]
    fschemas["zod schemas"]
  end
  subgraph server["src/server (server-only)"]
    usecases["use cases<br/>validate → authorize → domain → tx → audit"]
    ctx["request context<br/>session · membership · permissions"]
  end
  shell["components/layout<br/>AppShell · sidebar · ⌘K"]

  pages --> fui --> shell
  pages --> ctx
  actions --> usecases --> ctx
  handlers --> usecases
```

## Packages

```mermaid
flowchart LR
  web["apps/web"] --> ui["@ai-ems/ui"]
  web --> db["@ai-ems/db"]
  web --> sec["@ai-ems/security"]
  web --> domain["@ai-ems/domain"]
  web --> cfg["@ai-ems/config"]
  web --> obs["@ai-ems/observability"]
  db --> sec
  db --> cfg
  sec --> cfg
```

| Package                 | Key modules                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `@ai-ems/domain`        | `money/money`, `pricing/price-line`, `workflow/state-machine`, `workflow/machines`, `numbering/document-number`     |
| `@ai-ems/db`            | `client` (Prisma + pg adapter), `tenant` (scoped client), `tenant-scope` (pure guard), `generated/*`                |
| `@ai-ems/security`      | `authorization/permissions`, `authorization/authorize`, `authentication/supabase/{server,client,proxy}`, `http/csp` |
| `@ai-ems/ui`            | `components/ui/*` (32 primitives), `components/data/*`, `hooks/*`, `lib/{format,status,hotkeys,utils}`, `styles/*`  |
| `@ai-ems/config`        | `env`, `env.server`                                                                                                 |
| `@ai-ems/observability` | `logger`                                                                                                            |
