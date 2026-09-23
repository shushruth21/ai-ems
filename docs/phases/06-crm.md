# Phase 6 — CRM

**Status:** complete, waiting for approval before Phase 7 (Catalog).
**Builds on:** Phase 5 platform (`59f8cb0`). Earlier work was not redesigned; changes to existing files are in §2.
**Decision record:** [ADR 0010](../architecture/adr/0010-crm-ownership-numbering-and-lifecycle.md).

Accounts, contacts and leads: capture an enquiry, work it through a lifecycle with an append-only
timeline, and see the pipeline on the dashboard.

## 1. Architecture

```
/<slug>/crm/leads            list (search, sort, per-row status and overdue follow-ups)
/<slug>/crm/leads/new        capture form
/<slug>/crm/leads/<id>       details · lifecycle actions · timeline · owner
/<slug>/crm/accounts         companies, with contact and open-lead counts
/<slug>/crm/contacts         people, linked to their company
/<slug>/dashboard            pipeline by status + follow-ups that have slipped

server action → requireOrgContext(slug, permission) → ctx.db (tenant-scoped)
      │
packages/db/src/crm/*        accounts · contacts · leads · activities
      │  rules from packages/domain/crm/lead-policy.ts (pure, unit-tested)
      ▼
one transaction: lead row + activity row + audit row + outbox event
      └─ nextDocumentNumber(tx, org, "lead")  SELECT … FOR UPDATE → LD-2026-00001
```

| Concern     | Where                                   | Notes                                                         |
| ----------- | --------------------------------------- | ------------------------------------------------------------- |
| Ownership   | `packages/domain/crm/lead-policy.ts`    | Owner-only edits unless `crm.lead.assign`; unassigned is open |
| Lifecycle   | same file, on `defineMachine` (Phase 2) | Transitions as data — the UI offers exactly what's legal      |
| Numbering   | `packages/db/src/platform/sequences.ts` | Locked row, same transaction as the insert, yearly reset      |
| Persistence | `packages/db/src/crm/*`                 | Tenant-scoped client; audit + outbox in the same transaction  |
| Contracts   | `packages/contracts/src/crm.ts`         | Strings through validation; `toAmount` / `toDate` at the edge |
| Screens     | `apps/web/src/features/crm/*`           | Table, capture form, lead workspace, account/contact managers |

## 2. Folder structure (added or changed)

```
packages/domain/src/crm/lead-policy.ts        NEW  machine + ownership + follow-up age (+ 8 tests)
packages/contracts/src/crm.ts                 NEW  account, contact, lead, activity, filter schemas (+ tests)
packages/db/
  src/platform/sequences.ts                   NEW  nextDocumentNumber (FOR UPDATE, per tenant)
  src/crm/{types,accounts,contacts,leads,activities}.ts   NEW
  src/tenant-client.ts                        NEW  scopeToTenant(client, orgId) — no server-only import
  src/tenant.ts                               CHG  now binds the singleton to scopeToTenant
  prisma/seed.ts                              CHG  demo accounts, contacts and leads
  tests/integration/crm.test.ts               NEW  6 tests against the real migrations
apps/web/src/
  app/[org]/crm/leads/{page,new/page,[leadId]/page}.tsx   NEW
  app/[org]/crm/{accounts,contacts}/page.tsx              NEW
  app/[org]/dashboard/page.tsx                CHG  pipeline card + overdue follow-ups
  features/crm/{actions.ts,components/*}      NEW  leads table · lead form · lead workspace · managers
  config/navigation.ts                        CHG  Contacts entry
tests/e2e/crm.spec.ts                         NEW  4 journeys (× desktop and mobile)
docs/architecture/adr/0010-…md                NEW
```

## 3. Database changes

No migration: `accounts`, `contacts`, `leads` and `activities` were created by `20260922162750_init`,
and this phase is the first to use them. `pnpm db:diff:wasm` prints nothing, which CI enforces.

| Table        | Notes                                                                        |
| ------------ | ---------------------------------------------------------------------------- |
| `leads`      | `number` unique per workspace; `status`, `owner_id`, `next_follow_up_at`     |
| `activities` | Append-only timeline; `actor_id`, `occurred_at`; written by every transition |
| `accounts`   | `archived_at` instead of deletes; open leads block archiving                 |
| `contacts`   | Optional account link; emails are stored lower-cased                         |
| `sequences`  | Now read and written by `nextDocumentNumber` (was seeded but unused)         |

## 4. API design

No new HTTP routes. Server actions in `features/crm/actions.ts`:

| Action                                         | Permission          | Notes                                            |
| ---------------------------------------------- | ------------------- | ------------------------------------------------ |
| `newLead` / `editLead`                         | `crm.lead.write`    | Create redirects to the new lead's page          |
| `moveLead`                                     | `crm.lead.write`    | One lifecycle step; reason for lost/disqualified |
| `reassignLead`                                 | `crm.lead.assign`   | Notifies the new owner via the outbox            |
| `addActivity`                                  | `crm.lead.write`    | Also moves the follow-up date                    |
| `newAccount` / `editAccount` / `removeAccount` | `crm.account.write` | Archive, never delete                            |
| `newContact` / `editContact` / `removeContact` | `crm.account.write` | Archive, never delete                            |

## 5. Components

| Component          | Kind   | Notes                                                                       |
| ------------------ | ------ | --------------------------------------------------------------------------- |
| `LeadsTable`       | client | TanStack data table: search, sort, overdue dates in red, row → detail       |
| `LeadForm`         | client | One form for create and edit; account/contact pickers                       |
| `LeadWorkspace`    | client | Details, lifecycle buttons from the machine, reason prompt, timeline, owner |
| `AccountsManager`  | client | Inline create/edit, counts, archive                                         |
| `ContactsManager`  | client | Inline create/edit, account link, marketing opt-in                          |
| Dashboard pipeline | server | Counts and value per open status, plus slipped follow-ups                   |

## 6. Server actions

Every action re-resolves membership from the slug with `requireOrgContext`, parses with the Zod
contract, converts money and dates at that boundary, and hands the tenant-scoped client to the
repository, which applies the domain rules inside its transaction. A CRM change revalidates the whole
workspace subtree, because the same rows appear on the dashboard, the lists and the lead's own page.

## 7. Prisma models

Unchanged. `Account`, `Contact`, `Lead`, `Activity` and `Sequence` are used for the first time.
`Decimal` columns leave the repositories as `number`, and `Lead.estimatedValue` is the only money field
so far.

## 8. UI

Leads are a data table with the follow-up column turning red once a date has passed; the lead page is a
two-column workspace — details and timeline on the left, "next step" and owner on the right. Buttons come
from the state machine, so a lead in `NEW` never offers "Send proposal". Accounts and contacts use the
inline-form pattern from the members screen. Axe reports no serious or critical issues on any of the new
pages, desktop and mobile.

## 9. Validation

`packages/contracts/src/crm.ts`: names and free text within column limits, real websites and email
addresses only when filled in, money as `2500` or `12,500.50`, dates that actually exist (`2026-02-31` is
rejected), and only known lifecycle actions. The domain layer adds the rules that need context —
ownership, legal transitions, reason required, contact before qualifying, value before proposing.

## 10. Tests

| Suite                       | Count | Covers                                                                                                          |
| --------------------------- | ----- | --------------------------------------------------------------------------------------------------------------- |
| Unit (domain)               | 8     | Machine completeness, ownership, transition preconditions                                                       |
| Unit (contracts)            | 5     | Money and date parsing, optional fields, action whitelist                                                       |
| Integration (`packages/db`) | 6     | Gap-free numbering under concurrency, tenant isolation, lifecycle + timeline, reassignment, pipeline, archiving |
| E2E (`tests/e2e/crm`)       | 4 × 2 | Account/contact CRUD, full lead journey, dashboard pipeline, read-only member                                   |

Totals: `pnpm check` 34 tasks green, 33 integration, 114 e2e passed / 8 skipped.

## 11. Commands

```bash
pnpm dev:local                      # database + emulator + worker + app, with demo CRM data
pnpm check                          # typecheck · lint · unit tests · formatting
TEST_DATABASE_URL=postgresql://… pnpm test:integration
pnpm test:e2e
```

## 12. Verification checklist

- [x] Lead numbers are gap-free and per workspace, even when two are created at once
- [x] One workspace's accounts, contacts and leads are invisible to another
- [x] Only the owner (or someone with `crm.lead.assign`) can edit a lead or log activity on it
- [x] The UI offers only legal lifecycle steps; the server refuses the rest
- [x] Qualifying needs a contact, proposing needs a value, losing needs a reason
- [x] Every transition writes an activity row and an audit row in the same transaction
- [x] Reassignment notifies the new owner through the outbox worker
- [x] Accounts with open leads can't be archived; archived rows disappear from the lists
- [x] The dashboard pipeline and follow-ups update immediately after a change
- [x] `pnpm check`, integration and e2e green; no serious axe violations on the new pages
- [ ] Lead → quote conversion (Phase 9, once quotes exist)

## Next: Phase 7 (Catalog), for approval

- Products, options and variants — the things a quote will put on a line.
- Price rules and cost roll-up, on top of `packages/domain/pricing`.
- The first use of `catalog.*` permissions and the `catalog` sequence.
