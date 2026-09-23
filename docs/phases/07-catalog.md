# Phase 7 — Catalog

**Status:** complete, waiting for approval before Phase 8 (Configurator).
**Builds on:** Phase 6 CRM (`b56adfb`). Earlier work was not redesigned; changes to existing files are in §2.
**Decision record:** [ADR 0011](../architecture/adr/0011-catalog-options-and-publish-gate.md).

Categories, products and the options people choose from — with a publish gate that refuses to put an
unsellable product in front of a salesperson, and a price preview that runs the quote's arithmetic.

## 1. Architecture

```
/<slug>/catalog/products            list (search, status, options count, price)
/<slug>/catalog/products/new        capture form (SKU follows the name)
/<slug>/catalog/products/<id>       details · option groups + choices · price preview · availability
/<slug>/catalog/categories          the tree, with product counts

server action → requireOrgContext(slug, "catalog.product.write") → ctx.db (tenant-scoped)
      │
packages/db/src/catalog/*           categories · products · options
      │  rules from packages/domain/catalog/product-policy.ts
      ▼
publish gate: base price > 0 · configurable ⇒ ≥1 group · every choice list non-empty
price preview: unitPriceWithOptions(base, [Δ, %]) — the same function quotes will use
```

| Concern     | Where                                       | Notes                                                                  |
| ----------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| Identity    | `packages/domain/catalog/product-policy.ts` | SKU pattern + `skuFromName`, option codes from labels                  |
| Lifecycle   | same file, on `defineMachine`               | DRAFT ⇄ ACTIVE → DISCONTINUED; delete only unused drafts               |
| Pricing     | `unitPriceWithOptions`                      | Absolute deltas and percentages of the base, never compounded          |
| Persistence | `packages/db/src/catalog/*`                 | Tenant-scoped client, audit rows, unique codes per parent              |
| Contracts   | `packages/contracts/src/catalog.ts`         | Strings through validation; `toMoney` / `toOptionalNumber` at the edge |
| Screens     | `apps/web/src/features/catalog/*`           | Table, product form, option editor, categories manager                 |

## 2. Folder structure (added or changed)

```
packages/domain/src/catalog/product-policy.ts   NEW  machine, SKU/code helpers, publish gate (+ 8 tests)
packages/contracts/src/catalog.ts               NEW  category, product, group, option schemas (+ tests)
packages/db/src/catalog/{categories,products,options}.ts   NEW
packages/db/tests/integration/catalog.test.ts   NEW  6 tests against the real migrations
apps/web/src/
  app/[org]/catalog/products/{page,new/page,[productId]/page}.tsx   NEW
  app/[org]/catalog/categories/page.tsx                             NEW
  features/catalog/{actions.ts,components/*}   NEW  products table · product form · workspace · option forms · categories
  config/navigation.ts                         CHG  Categories entry
tests/e2e/catalog.spec.ts                      NEW  4 journeys (× desktop and mobile)
docs/architecture/adr/0011-…md                 NEW
```

## 3. Database changes

No migration: `product_categories`, `products`, `option_groups` and `product_options` were created by
`20260922162750_init`. `pnpm db:diff:wasm` prints nothing, which CI enforces.

| Table                | Notes                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `products`           | `sku` unique per workspace; `status` drives visibility; `is_configurable` |
| `option_groups`      | `code` unique per product, generated from the label                       |
| `product_options`    | `code` unique per group; `price_delta` and `price_pct_delta`              |
| `product_categories` | Self-referencing tree; `active` instead of deletes                        |

`price_rules` is still untouched — volume breaks and customer tiers arrive with quotes.

## 4. API design

No new HTTP routes. Server actions in `features/catalog/actions.ts`, all gated on
`catalog.product.write`: `newProduct`, `editProduct`, `moveProduct` (publish / unpublish / discontinue /
restore), `removeProduct`, `saveGroup`, `removeGroup`, `saveChoice`, `removeChoice`, `newCategory`,
`editCategory`, `removeCategory`. Reading needs `catalog.product.read`.

## 5. Components

| Component                  | Kind   | Notes                                                            |
| -------------------------- | ------ | ---------------------------------------------------------------- |
| `ProductsTable`            | client | Data table: SKU, status, option count, lead time, price          |
| `ProductForm`              | client | Create and edit; SKU follows the name until it's edited          |
| `ProductWorkspace`         | client | Options editor, availability actions, live price preview         |
| `GroupForm` / `OptionForm` | client | Inline editors; the numeric range appears only for number groups |
| `CategoriesManager`        | client | Inline create/edit, nesting, product counts                      |

## 6. Server actions

Each action re-resolves membership from the slug, parses with the Zod contract, converts money and
numbers at that boundary, and hands the tenant-scoped client to the repository, which applies the policy.
Catalog changes revalidate the whole workspace subtree — a product appears in the list, on its own page
and (soon) on quote lines.

## 7. Prisma models

Unchanged. `ProductCategory`, `Product`, `OptionGroup` and `ProductOption` are used for the first time;
`Decimal` columns leave the repositories as `number`.

## 8. UI

The product page is a two-column workspace: details and options on the left, price preview and
availability on the right. The preview is live — choose "Olive velvet" and the unit price moves — and the
availability panel explains what is missing rather than showing a disabled button. Axe reports no serious
or critical violations on any new page, desktop and mobile.

## 9. Validation

`packages/contracts/src/catalog.ts`: SKUs and category codes are upper-cased and pattern-checked, labels
have length limits, money is `1200` or `1,200.50` (option deltas may be negative), percentages allow four
decimals, and numeric ranges are optional but must be numbers. The domain adds the contextual rules:
publish readiness, empty choice lists, upside-down ranges, delete-only-unused-drafts.

## 10. Tests

| Suite                       | Count | Covers                                                                                 |
| --------------------------- | ----- | -------------------------------------------------------------------------------------- |
| Unit (domain)               | 8     | Machine, SKU/code generation, publish gate, price arithmetic                           |
| Unit (contracts)            | 4     | Normalisation, money and percentages, optional numeric ranges                          |
| Integration (`packages/db`) | 6     | SKU uniqueness, publish gate, unique codes, free-text groups, tree cycles, audit trail |
| E2E (`tests/e2e/catalog`)   | 4 × 2 | Category tree, configurable product journey, SKU collisions, read-only member          |

Totals: `pnpm check` 34 tasks green, 39 integration, 122 e2e passed / 8 skipped.

## 11. Commands

```bash
pnpm dev:local                      # database + emulator + worker + app, with demo catalog data
pnpm check
TEST_DATABASE_URL=postgresql://… pnpm test:integration
pnpm test:e2e
```

## 12. Verification checklist

- [x] SKUs and category codes are unique per workspace, whatever case they're typed in
- [x] The SKU follows the product name until someone edits it, and never mangles a typed one
- [x] A configurable product can't be published without at least one usable option group
- [x] A choice list with no choices blocks publishing and says so
- [x] Option and group codes are generated, unique per parent, and stable
- [x] Numeric groups reject an upside-down range; free-text groups reject a list of options
- [x] A category can't be moved inside itself; categories in use can't be removed
- [x] Only unused drafts can be deleted; live products are discontinued instead
- [x] The price preview matches the arithmetic quotes will use
- [x] `pnpm check`, integration and e2e green; no serious axe violations on the new pages
- [ ] Saved configurations against quote lines (Phase 8)

## Next: Phase 8 (Configurator), for approval

- A guided configurator that saves a chosen configuration, validated against the option groups.
- Visibility rules (`option_groups.visible_when`) so irrelevant questions stay hidden.
- Price rules — volume breaks and customer tiers — applied on top of the option deltas.
