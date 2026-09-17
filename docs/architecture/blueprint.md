# AI EMS — Product & Architecture Blueprint

**Product:** AI-Powered Enterprise Management System (AI EMS)
**Type:** Multi-tenant B2B SaaS for make-to-order businesses. It covers the full cycle from demand through production to delivery and cash.
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui · Supabase (Auth, Postgres, Storage, Realtime) · Prisma 7 · TanStack Query · React Hook Form + Zod · Framer Motion · Vitest · Playwright

> **Clean-room statement.** A downloaded third-party application was studied **only** to learn which business workflows a make-to-order enterprise needs. It is referred to here generically as "the reference app".
> This project contains **no** code, branding, names, colors, assets, data records or implementation details from it.
> All identifiers, UI, schema and sample data are original. Sample data uses the fictional tenant **"Demo Industries"**.

---

## 1. Product principles

1. **Tenant-first.** Every business record belongs to an `Organization`. Isolation is enforced in the database (RLS) and in the server (a tenant-scoped Prisma client), not in the UI.
2. **Permissions, not hard-coded roles.** Roles are named bundles of permissions (`sales.order.approve`). Each tenant can edit them.
3. **One source of truth per fact.** The schema is normalized. There are no whole-app JSON blobs. Stock is a ledger. Document numbers come from database sequences.
4. **Workflows are explicit state machines.** Each state change is a server action that validates the transition, writes an audit event and emits a domain event through an outbox.
5. **The server decides money.** Prices, discounts, taxes and commissions are calculated and validated on the server.
6. **URL is state.** Every screen, tab, filter and record is linkable.
7. **AI is an assistant, never an unaudited actor.** AI reads through the same permission-checked services as a user. AI-proposed writes need a human to confirm them and are audited as `actor=ai, approvedBy=user`.

## 2. Personas

| Persona                      | Primary jobs                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| Owner / Executive            | Company health, cash, pipeline, bottlenecks, AI daily brief                                |
| Sales rep / Sales manager    | Leads → quotes → orders, follow-ups, targets, discount approvals                           |
| Pre-sales / Marketing        | Lead capture and qualification, campaigns, attribution                                     |
| Product engineer             | Product catalog, configurator rules, BOM and routing templates                             |
| Planner / Production manager | Work orders, capacity, schedule board, exceptions                                          |
| Shop-floor operator          | Kiosk: scan a work order, start/stop an operation, report an issue                         |
| Quality inspector            | Inspection checklists (inbound, in-process, final), non-conformance reports (NCRs), rework |
| Buyer / Procurement manager  | Requisitions → purchase orders → receipts, supplier performance                            |
| Warehouse                    | Receiving, put-away, picking, cycle counts, reservations                                   |
| Logistics                    | Packing, shipments, delivery routes, proof of delivery                                     |
| Finance                      | Invoices, payments, bills, 3-way match, credit notes, exports                              |
| HR                           | Employees, attendance, leave, shifts, payroll export                                       |
| Service agent                | Tickets, SLAs, warranty, field visits                                                      |
| Partner (external)           | Portal for referrals, orders and commission statements                                     |
| Tenant admin                 | Users, roles, settings, custom fields, integrations, billing                               |

## 3. Module map

| #   | Module                     | Key entities                                                                             | Core workflows                                           | AI features                                          |
| --- | -------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| M0  | **Platform**               | Organization, Membership, Role, Permission, Invitation, ApiKey, Subscription, AuditEvent | Sign-up → create org → invite → assign roles             | —                                                    |
| M1  | **CRM**                    | Lead, Contact, Account, Activity, PipelineStage                                          | Capture → qualify → convert → nurture                    | Lead scoring, conversation summary, next-best-action |
| M2  | **Catalog & Configurator** | Product, ProductVariant, OptionGroup, Option, PriceRule, BomTemplate                     | Define product → options → rule-based price → publish    | Description generation, price-anomaly check          |
| M3  | **Sales**                  | Quote, SalesOrder, OrderLine, DiscountApproval, Payment                                  | Quote → approve discount → order → confirm → invoice     | Quote drafting, win-probability estimate             |
| M4  | **Engineering**            | BillOfMaterials, BomLine, Routing, RoutingStep                                           | Order line → BOM explode → engineer review → release     | BOM completeness check                               |
| M5  | **Inventory**              | Item, Warehouse, Location, StockLevel, StockMovement, Reservation, CycleCount            | Receive → put-away → reserve → issue → count             | Reorder suggestions, demand forecast                 |
| M6  | **Procurement**            | Supplier, PurchaseRequisition, PurchaseOrder, GoodsReceipt, SupplierPrice                | Requisition → PO → approve → send → receive → match      | Supplier risk, price-variance alerts                 |
| M7  | **Production**             | WorkOrder, Operation, WorkCenter, TimeLog, ProductionIssue                               | Release → schedule → execute ops → complete              | Schedule optimization hints, delay prediction        |
| M8  | **Quality**                | InspectionPlan, Inspection, InspectionResult, NonConformance                             | Inspect → pass/fail → NCR → rework/return                | Defect clustering, photo-based defect notes          |
| M9  | **Fulfillment**            | Shipment, ShipmentLine, DeliveryRoute, ProofOfDelivery                                   | Pack → ready → route → deliver → POD                     | Route grouping suggestions                           |
| M10 | **Finance**                | Invoice, Bill, Payment, CreditNote, TaxRate                                              | Invoice → collect; bill → match → pay                    | Collections prioritization, cash forecast            |
| M11 | **People**                 | Employee, Department, Shift, Attendance, LeaveRequest                                    | Onboard → schedule → attendance → leave → payroll export | Attendance anomaly flags                             |
| M12 | **Service**                | Ticket, SlaPolicy, Warranty, ServiceVisit                                                | Open → triage → assign → visit → resolve                 | Auto-triage, reply drafts                            |
| M13 | **Partners**               | Partner, Referral, CommissionPlan, CommissionStatement                                   | Onboard → refer → earn → pay out                         | Partner health score                                 |
| M14 | **Marketing**              | Campaign, CampaignSpend, Attribution                                                     | Plan → spend → leads → ROI                               | Budget reallocation advice                           |
| M15 | **Collaboration**          | Comment, Mention, Task, Notification, Attachment                                         | Comment/mention on any record, tasks, inbox              | Thread summaries                                     |
| M16 | **Analytics & Copilot**    | Dashboard, SavedView, Digest                                                             | KPIs per role, drill-down                                | Natural-language Q&A, daily brief, anomaly alerts    |

**Release plan:**

- MVP: M0, M1, M2, M3, M5, M6, M7, M15, plus basic M16.
- v1.1: M8, M9, M10.
- v1.2: M11, M12, M13, M14, plus full Copilot.

## 4. End-to-end flow (order to cash)

```
Lead ──qualify──▶ Account/Contact ──▶ Quote (configurator, server pricing)
  └─ discount > policy? ──▶ DiscountApproval
Quote ──accept──▶ SalesOrder (CONFIRMED) ──▶ BOM explode (Engineering)
  ├─ Reservation against stock ── shortfall ──▶ PurchaseRequisition ──▶ PO ──▶ GoodsReceipt ──▶ Inspection(IN)
  └─ WorkOrder per line ──▶ Operations (kiosk time logs) ──▶ Inspection(IN_PROCESS) … ──▶ Inspection(FINAL)
        └─ fail ──▶ NonConformance ──▶ rework Operation
WorkOrder COMPLETED ──▶ Shipment (PACKED → SCHEDULED → DELIVERED + POD)
SalesOrder ──▶ Invoice ──▶ Payments ──▶ PAID ──▶ Ticket / Warranty (service)
```

### State machines (v1)

| Document      | States                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| Quote         | `DRAFT → PENDING_APPROVAL → SENT → ACCEPTED \| REJECTED \| EXPIRED`                                     |
| SalesOrder    | `DRAFT → CONFIRMED → IN_PRODUCTION → READY → PARTIALLY_SHIPPED → SHIPPED → CLOSED`; also `CANCELLED`    |
| PurchaseOrder | `DRAFT → PENDING_APPROVAL → APPROVED → SENT → PARTIALLY_RECEIVED → RECEIVED → CLOSED`; also `CANCELLED` |
| WorkOrder     | `PLANNED → RELEASED → IN_PROGRESS → ON_HOLD → COMPLETED`; also `CANCELLED`                              |
| Inspection    | `PENDING → PASSED \| FAILED \| CONDITIONAL`                                                             |
| Shipment      | `PENDING → PACKED → SCHEDULED → IN_TRANSIT → DELIVERED \| FAILED`                                       |
| Invoice       | `DRAFT → ISSUED → PARTIALLY_PAID → PAID → VOID`                                                         |
| Ticket        | `OPEN → TRIAGED → IN_PROGRESS → WAITING → RESOLVED → CLOSED`                                            |

These are implemented as pure functions in `src/domain/workflow/*`. Server actions call them, and they are 100% unit-tested.

## 5. System architecture

```
Browser (RSC + client islands)
   │  TanStack Query (client cache) · Supabase Realtime (invalidation only)
   ▼
Next.js 16 on Vercel ──────────────────────────────────────────────┐
 ├─ proxy.ts: session refresh, auth redirect, security headers     │
 ├─ app/(app)/** Server Components → services (read)               │
 ├─ Server Actions / Route Handlers → services (write)             │
 │     zod validate → authorize(permission) → domain rule          │
 │     → prisma.$transaction → audit + outbox                      │
 ├─ app/api/v1/** public REST (API keys), webhooks (HMAC)          │
 └─ app/api/ai/** Copilot (streaming) → tool calls → services      │
   │                                                               │
   ▼                                                               │
Prisma 7 (driver adapter pg) ── pooled ──▶ Supabase Postgres ◀─────┘
                                          ├─ RLS on every tenant table (defense in depth)
                                          ├─ sequences for document numbers
                                          ├─ outbox table → Edge Function / cron workers
                                          └─ Realtime (row changes → cache invalidation)
Supabase Storage: private buckets per tenant prefix, signed URLs
Supabase Auth: email/password, magic link, Google/Microsoft OAuth, MFA (TOTP)
```

### Workspaces and layers

The repository is a pnpm + Turborepo monorepo (see [ADR 0001](adr/0001-monorepo-pnpm-turborepo.md)).

| Workspace                  | Responsibility                                                                                   | May depend on                   |
| -------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------- |
| `apps/web`                 | Routes, layouts, server actions, route handlers, feature UI (`src/features/<module>`), app shell | every package below             |
| `packages/domain`          | Pure TS: state machines, pricing, money, numbering                                               | nothing (enforced by ESLint)    |
| `packages/db`              | Prisma schema/client, tenant-scoped client, seed                                                 | `security`, `config`            |
| `packages/security`        | Permission catalog, `authorize`, Supabase auth clients, CSP                                      | `config`                        |
| `packages/ui`              | Design tokens, primitives, data components, hooks                                                | —                               |
| `packages/config`          | Environment validation, feature flags                                                            | —                               |
| `packages/observability`   | Structured logging (metrics/tracing later)                                                       | —                               |
| `services/*` (Phase 20–21) | Python AI/ingestion services                                                                     | contracts over HTTP/events only |

Inside `apps/web/src`: `app/` (routes) → `features/<module>/` (UI, hooks, schemas) → `server/` (use cases: validate → authorize → domain → transaction → audit/outbox; `server-only`).

## 6. Multi-tenancy and security model

- **Identity:** Supabase `auth.users` ↔ `Profile` (1:1). A user can belong to many organizations through `Membership`. The active org is kept in a cookie and verified against memberships on every request.
- **Server enforcement:** `getTenantDb(ctx)` returns a Prisma client extension that injects `organizationId` into every `where` and `data` on tenant models, and refuses queries without it.
- **Database enforcement:** RLS policies on every tenant table, `organization_id = any(auth.org_ids())`, backed by a `SECURITY DEFINER` function that reads memberships. This protects direct Supabase access (Realtime, Storage, future mobile apps).
- **Authorization:** `authorize(ctx, 'sales.order.approve')`. Permissions are seeded as a catalog, roles are per tenant, and system roles are `owner`, `admin`, `member` and `viewer`, plus templates per persona.
- **Audit:** an append-only `AuditEvent` records actor, action, entity, before/after diff, IP and user agent for every write.
- **Secrets:** Zod-validated environment variables. The service-role key is server-only and never sent to the browser.
- **Headers:** strict CSP with nonce, HSTS, `frame-ancestors 'none'`, Referrer-Policy and Permissions-Policy.
- **Rate limits:** on auth, AI and public API endpoints.
- **PII:** masked phone and email projections for roles without `crm.contact.reveal`. Reveals are audited.
- **Files:** private buckets, a signed URL per request, MIME and size validation, optional AV scan hook.

## 7. Data model overview (Prisma, multi-file schema)

| File                 | Models                                                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `platform.prisma`    | Organization, Profile, Membership, Role, Permission, RolePermission, Invitation, ApiKey, AuditEvent, Sequence, OutboxEvent, Setting |
| `collab.prisma`      | Comment, Task, Notification, Attachment                                                                                             |
| `crm.prisma`         | Account, Contact, Lead, Activity                                                                                                    |
| `catalog.prisma`     | ProductCategory, Product, OptionGroup, ProductOption, PriceRule                                                                     |
| `sales.prisma`       | Quote, QuoteLine, SalesOrder, SalesOrderLine, Payment                                                                               |
| `inventory.prisma`   | Item, Warehouse, StockLevel, StockMovement, Reservation                                                                             |
| `procurement.prisma` | Supplier, PurchaseOrder, PurchaseOrderLine, GoodsReceipt                                                                            |
| `production.prisma`  | WorkCenter, BillOfMaterials, BomLine, WorkOrder, WorkOrderOperation, TimeLog                                                        |
| `quality.prisma`     | InspectionPlan, Inspection, NonConformance                                                                                          |
| `fulfillment.prisma` | Shipment, ShipmentLine                                                                                                              |
| `finance.prisma`     | Invoice, InvoiceLine                                                                                                                |

**Conventions:**

- Primary keys are `cuid2` text.
- `organizationId` is on every tenant row.
- Money is `Decimal(14,2)`; quantities are `Decimal(14,3)`.
- Tables have `createdAt`, `updatedAt`, `createdById`, and a `version` column for optimistic locking.
- Archiving is a soft delete through `archivedAt`.
- Table names are `snake_case` via `@@map`.
- Composite indexes start with `organizationId`.

## 8. Routing

```
/                          marketing landing (public)
/login /signup /forgot-password /auth/callback
/onboarding                create or join organization
/[org]/dashboard
/[org]/crm/{leads,accounts,contacts,pipeline}
/[org]/catalog/{products,configurator,price-rules}
/[org]/sales/{quotes,orders}/[id]?tab=
/[org]/inventory/{items,stock,movements,counts}
/[org]/procurement/{requisitions,purchase-orders,receipts,suppliers}
/[org]/production/{work-orders,schedule,work-centers}
/[org]/quality/{inspections,ncr,plans}
/[org]/fulfillment/{shipments,routes}
/[org]/finance/{invoices,bills,payments}
/[org]/people/{employees,attendance,leave,shifts}
/[org]/service/{tickets,visits}
/[org]/partners  /[org]/marketing
/[org]/inbox  /[org]/tasks  /[org]/copilot
/[org]/settings/{general,members,roles,custom-fields,integrations,billing,audit-log}
/kiosk/[org]               shop-floor device mode
/portal/[org]              partner portal
/api/v1/**                 public REST (API key)
/api/webhooks/**           signed inbound webhooks
```

## 9. Design language (original)

- **Name and mark:** "AI EMS", a geometric hexagon mark with a spark (drawn as original SVG).
- **Palette:** indigo-violet primary `oklch(0.55 0.19 275)`, cool slate neutrals, and semantic success, warning, danger and info colors. Light and dark themes are both first-class.
- **Type:** Inter (UI) and JetBrains Mono (codes and numbers). Body text is 14px, dense data tables are 13px, and nothing is smaller than 12px.
- **Layout:** collapsible sidebar (icon rail ↔ full width), command palette (⌘K), breadcrumb top bar, and a right-side detail drawer for records.
- **Motion:** 150–250ms ease-out for drawers, dialogs and toasts. Reduced-motion is respected.
- **Accessibility target:** WCAG 2.2 AA.

## 10. AI architecture

- **Provider abstraction:** `server/ai/provider.ts`, with a Claude model by default, configurable through env. Calls run only on the server and are streamed to the client.
- **Tools:** read-only tool functions (`searchOrders`, `getStockLevel`, `listOverdueInvoices`, …) that call the same services under the requesting user's permissions and tenant.
- **Writes:** the model returns a _proposal_ (a Zod-typed action). The UI shows a diff, and the user confirms. The audit log records `via=copilot`.
- **Background jobs:** daily digest per role, anomaly scans (stock-outs, late work orders, margin leaks) and lead scoring. They run through the outbox worker or Vercel Cron.
- **Guardrails:** token budgets per tenant plan, PII redaction in prompts where possible, prompt and response logging with opt-out, and an eval set for tools.

## 11. Non-functional targets

| Area         | Target                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------- |
| Performance  | p75 LCP < 2.0 s, INP < 200 ms; route JS < 200 KB gzip; list pages virtualized beyond 200 rows |
| Availability | 99.9% (Vercel + Supabase Pro)                                                                 |
| Scale        | 500 tenants × 200 users for v1; 10M stock movements per tenant                                |
| Security     | OWASP ASVS L2; RLS on 100% of tenant tables                                                   |
| Quality      | Domain coverage ≥ 90%; critical E2E flows green in CI; axe: 0 serious violations              |

## 12. Phase plan

| Phase | Scope                                                                                                                                                          | Exit criteria                                                        |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 0     | This blueprint                                                                                                                                                 | Approved                                                             |
| **1** | Foundation: scaffold, TS strict, Tailwind v4, ESLint, Prettier, Husky, commitlint, env validation, Prisma schema v1, Supabase clients, proxy, Docker, CI       | typecheck, lint, test and build all green; `prisma validate` passes  |
| 2     | Design system and app shell: tokens, shadcn primitives, sidebar, top bar, ⌘K, theming, auth pages, onboarding, org switcher                                    | Auth round-trip works; shell is responsive; axe clean                |
| 3     | Modules, one at a time: Catalog → CRM → Sales → Inventory → Procurement → Production → Quality → Fulfillment → Finance → People → Service → Partners/Marketing | Each module has its CRUD, workflow, permissions, tests and seed data |
| 4     | Shared components hardening: DataTable, forms, drawers, kanban, charts, file upload, signature, QR                                                             | Storybook-style gallery page                                         |
| 5     | Motion and polish                                                                                                                                              | Reduced-motion verified                                              |
| 6     | Responsive: mobile, tablet, desktop, ultra-wide; kiosk mode                                                                                                    | Playwright viewport suite                                            |
| 7     | Optimization: caching, streaming, image and route budgets, SEO for public pages                                                                                | Lighthouse CI budgets pass                                           |
| 8     | Testing and release: unit, integration (test DB), E2E, a11y, load smoke; Vercel + Docker                                                                       | Release checklist                                                    |
| 9     | AI Copilot and SaaS billing                                                                                                                                    | Copilot tool evals pass; Stripe test mode flows                      |
