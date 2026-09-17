# Product requirements

## Vision

A single, AI-assisted platform that runs a make-to-order business end to end: lead → quote → order → build → inspect → ship → invoice → service. It serves manufacturers, furniture makers, retailers with custom orders, and construction and fit-out companies.

## Functional requirements (by module)

| ID    | Requirement                                                                                            | Phase |
| ----- | ------------------------------------------------------------------------------------------------------ | ----- |
| PLT-1 | Users sign up, sign in (password, magic link, OAuth), verify email, reset password, and enrol MFA      | 3     |
| PLT-2 | Users create or join organizations. Each org has members, roles and invitations.                       | 4–5   |
| PLT-3 | Admins edit roles as bundles of permissions. Every action is permission-checked on the server.         | 4–5   |
| PLT-4 | Every write is audited (actor, time, before/after)                                                     | 5     |
| CRM-1 | Capture leads from forms, walk-ins, calls and partners; assign owners; track activities and follow-ups | 6     |
| CAT-1 | Products with categories, option groups, options and rule-based prices                                 | 7–8   |
| SAL-1 | Quotes priced on the server; discounts above policy require approval; accepted quotes become orders    | 9     |
| INV-1 | Ledger-based stock per warehouse, with reservations and cycle counts                                   | 10    |
| PRC-1 | Purchase orders with approval, goods receipts and inbound inspection                                   | 11    |
| PRD-1 | BOMs, work orders with operations, and shop-floor time tracking via kiosk                              | 12    |
| QLT-1 | Inspection plans, inspections and non-conformances with disposition                                    | 13    |
| LOG-1 | Shipments with scheduling and proof of delivery                                                        | 14    |
| FIN-1 | Invoices, payments (idempotent) and collections                                                        | 15    |
| AI-1  | Copilot answers questions using only data the user can see; any write needs approval                   | 21    |

## Non-functional requirements

| Area           | Target                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| Performance    | p75 LCP < 2.0 s, INP < 200 ms; route JS < 200 KB gzip                   |
| Availability   | 99.9% monthly                                                           |
| Security       | OWASP ASVS L2; RLS on 100% of tenant tables; MFA available to all users |
| Accessibility  | WCAG 2.2 AA (axe: zero serious or critical issues)                      |
| Scale (v1)     | 500 tenants × 200 users; 10M stock movements per tenant                 |
| Data residency | Region chosen per deployment (Supabase project region)                  |
