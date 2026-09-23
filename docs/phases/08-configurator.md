# Phase 8 — Configurator

**Status:** complete, waiting for approval before Phase 9 (Sales).
**Builds on:** Phase 7 catalog (`69ca309`). Earlier work was not redesigned; changes to existing files are in §2.
**Decision record:** [ADR 0012](../architecture/adr/0012-configurator-rules-and-saved-configurations.md).

Answering a product's questions — with the irrelevant ones hidden — and saving the result as a priced
configuration that a lead can carry and a quote can pick up.

## 1. Architecture

```
/<slug>/catalog/products/<id>/configure
   │  visibleGroups(spec, answers)      → only the questions that apply
   │  priceConfiguration(spec, answers) → running total, live in the browser
   ▼
server action → requireOrgContext(slug, "sales.quote.write")
   │  the SAME pure functions re-run on the server; only answers cross the wire
   ▼
saved_configurations   answers · quantity · unit price · total · breakdown
   ├─ shown on the product page
   └─ shown on the lead it was put against

option_groups.visible_when   { group: "fabric", equals: "olive_velvet" }
   authored in the group editor · refused if the group or option doesn't exist
```

| Concern        | Where                                          | Notes                                                  |
| -------------- | ---------------------------------------------- | ------------------------------------------------------ |
| Rules          | `packages/domain/catalog/configuration.ts`     | Visibility, validation, pricing — pure and shared      |
| Money          | `packages/domain/money` + `pricing/price-line` | bigint minor units; the quote line's own arithmetic    |
| Persistence    | `packages/db/src/catalog/configurator.ts`      | Re-validates, prices server-side, stores the breakdown |
| Rule authoring | `features/catalog/components/option-forms.tsx` | "Only ask when <question> is <answer>"                 |
| Screen         | `features/catalog/components/configurator.tsx` | Live total, inline issues, save to a lead              |

## 2. Folder structure (added or changed)

```
packages/domain/src/catalog/configuration.ts     NEW  visibility · validation · pricing (+ 12 tests)
packages/contracts/src/catalog.ts                CHG  configuration + visibility-rule schemas
packages/db/
  prisma/schema/catalog.prisma                   CHG  SavedConfiguration model
  prisma/migrations/20260923110423_saved_configurations/   NEW
  src/catalog/configurator.ts                    NEW  spec loader · save · list · delete
  src/catalog/options.ts                         CHG  visible_when, with trigger checks
  src/catalog/products.ts                        CHG  groups carry their rule
  tests/integration/catalog.test.ts              CHG  +3 tests (9 total)
apps/web/src/
  app/[org]/catalog/products/[productId]/configure/page.tsx   NEW
  app/[org]/catalog/products/[productId]/page.tsx             CHG  saved configurations
  app/[org]/crm/leads/[leadId]/page.tsx                       CHG  saved configurations
  features/catalog/components/configurator.tsx                NEW
  features/catalog/components/saved-configurations.tsx        NEW
  features/catalog/components/option-forms.tsx                CHG  rule editor
  features/catalog/actions.ts                                 CHG  save / remove configuration
tests/e2e/configurator.spec.ts                   NEW  3 journeys (× desktop and mobile)
docs/architecture/adr/0012-…md                   NEW
```

## 3. Database changes

One migration — the first since the initial schema.

| Table                  | Notes                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| `saved_configurations` | `answers` (JSONB), `quantity`, `unit_price`, `total`, `price_breakdown`   |
|                        | Optional `lead_id` (set null on delete); cascades with product and tenant |
| `option_groups`        | `visible_when` now written and read (was defined but unused)              |

The RLS foundation enables the tenant policy on every table with an `organization_id`, so the new table
is covered by re-running `pnpm db:sql`. `pnpm db:diff:wasm` prints nothing.

## 4. API design

No new HTTP routes. Server actions: `saveConfiguredProduct` and `removeConfiguration`, both gated on
`sales.quote.write` — configuring is a selling act, not a catalog edit. Reading the saved list needs
`sales.quote.read`.

## 5. Components

| Component             | Kind   | Notes                                                                                      |
| --------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `Configurator`        | client | Renders whichever groups are visible; live breakdown and total; inline per-question issues |
| `SavedConfigurations` | client | The saved list on a product or a lead, with its summary and total                          |
| `GroupForm`           | client | Now also authors "only ask when … is …"                                                    |

## 6. Server actions

`saveConfiguredProduct` parses the answers JSON defensively, then hands them to `saveConfiguration`,
which re-reads the product, re-validates, re-prices and stores the server's numbers. An invalid
configuration comes back with the same messages the configurator shows. `removeConfiguration` deletes
one and audits it.

## 7. Prisma models

`SavedConfiguration` is new. `Product`, `Lead` and `Organization` gained the back-relation; nothing else
changed.

## 8. UI

The configurator is a two-column page: questions on the left, a running breakdown on the right that
shows base price and each option's contribution, then the unit price and the line total. Questions that
don't apply are simply absent — no greyed-out clutter. Saving asks for a name and, optionally, a lead.
Axe reports no serious or critical violations, desktop and mobile.

## 9. Validation

Answers are validated against the product's own groups: option codes must belong to the group, numbers
must sit inside the group's range, multi-selects are de-duplicated, text is length-capped, and required
questions must be answered — but only the ones being shown. A rule that points at a missing group or
option, or at the group's own answer, is refused when the group is saved.

## 10. Tests

| Suite                          | Count | Covers                                                                                                                  |
| ------------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------- |
| Unit (domain)                  | 12    | Visibility (incl. all/any/not), required-when-visible, dropped answers, ranges, pricing with quantity, discount and tax |
| Integration (`packages/db`)    | 9     | Hidden-question flow end to end, invented answers refused, drafts refused, rule triggers checked                        |
| E2E (`tests/e2e/configurator`) | 3 × 2 | Question appears only for velvet, live price, save and list; save against a lead; draft can't be configured             |

Totals: `pnpm check` 34 tasks green, 42 integration, 128 e2e passed / 8 skipped.

## 11. Commands

```bash
pnpm dev:local
pnpm check
TEST_DATABASE_URL=postgresql://… pnpm test:integration
pnpm test:e2e
```

## 12. Verification checklist

- [x] A question hidden by a rule is neither asked nor required
- [x] Changing an earlier answer drops the answers it hides, without an error
- [x] The browser's running total and the saved price come from the same functions
- [x] Only answers cross the wire; the server prices and stores its own numbers
- [x] Invented option codes, out-of-range numbers and missing required answers are refused server-side
- [x] Only a published product can be configured
- [x] A rule can't point at a missing group or option, or at its own group
- [x] A saved configuration shows on the product and on the lead it was put against
- [x] Money runs through minor units end to end — no floats
- [x] `pnpm check`, integration and e2e green; no serious axe violations
- [ ] Turning a saved configuration into a quote line (Phase 9)

## Next: Phase 9 (Sales), for approval

- Quotes with lines built from saved configurations, discount policy and approval.
- The quote lifecycle machine that already exists in `packages/domain/workflow`.
- Sales orders on acceptance, and the first use of `sales.*` permissions beyond reading.
