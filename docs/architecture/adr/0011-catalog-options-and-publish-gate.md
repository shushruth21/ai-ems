# 0011. Catalog structure, product options and the publish gate

- **Status:** accepted
- **Date:** 2026-09-23

## Context

The catalog is what every later module quotes, orders, builds and invoices. It has to answer two
questions the rest of the system will lean on: what identifies a product, and how do the choices a
customer makes change its price. It also has to stop half-finished products reaching a salesperson.

## Decision

1. **SKU is the identity, and it is generated but editable.** A SKU is uppercase letters, digits and
   dashes, unique per workspace, and the form derives one from the product's name while nobody has typed
   in the field themselves. Deriving it on every keystroke rather than on blur avoids the ordering bug
   where a typed SKU and a generated one end up concatenated — a real failure this phase hit and the e2e
   suite caught. The domain owns both `skuFromName` and the pattern, so the database, the form and any
   future import path agree.
2. **Options are groups with choices, priced as a delta.** An option group says what the customer is
   choosing (pick one, pick several, a number, free text, yes/no); a choice carries an absolute delta and
   a percentage of the base. Percentages always apply to the base and never compound, which keeps the
   price explainable on a quote line: base + Δ₁ + Δ₂ … Both group codes (`fabric_colour`) and choice
   codes are generated from labels and made unique per parent, because a configuration saved against a
   quote must still make sense after someone renames the label.
3. **Publishing is the gate, not saving.** A product is a draft until it can actually be sold: it needs
   a base price above zero, and if it is configurable, at least one option group where every choice list
   has something to choose. The rules live in `canTransitionProduct`, so the editor shows the reason and
   the server enforces it. Draft products are invisible to the rest of the system by status, not by a
   separate table.
4. **The lifecycle is a machine, as in Phase 6.** DRAFT → ACTIVE → DISCONTINUED, with `unpublish` and
   `restore` back to draft. Discontinued products stay for history's sake; only an unused draft can be
   deleted outright, and "unused" means no quote or order line points at it.
5. **Categories are a shallow tree with a cycle guard.** A category can sit inside another, but the
   update path walks the ancestry and refuses to make a category its own descendant. Categories in use —
   with products or children — are deactivated rather than removed.
6. **The price preview runs the same arithmetic as the quote will.** `unitPriceWithOptions` is pure and
   shared: the product page uses it live in the browser, and Phase 9's quote lines will use the same
   function server-side through `packages/domain/pricing`. A pricing surprise then shows up while the
   catalog is being edited, not on a customer's quote.

## Consequences

- Catalogue edits are workspace-wide rather than owned by a person, so `catalog.product.write` is the only
  gate. The audit trail records who changed what, as everywhere else.
- Option _values_ aren't stored against anything yet. The configurator (Phase 8) will save a chosen
  configuration against a quote line, referring to the codes this phase fixes; that is why codes are
  generated, unique and never reused within a parent.
- `PriceRule` exists in the schema but is untouched: volume breaks and customer tiers belong with quotes,
  where there is a customer and a quantity to apply them to.
- A product that becomes configurable after publication keeps selling until someone unpublishes it; the
  gate only runs on the way in. That is deliberate — pulling a live product out of a salesperson's hands
  silently would be worse than a brief inconsistency the editor can see.
