# 0012. Configurator rules, server-side pricing and saved configurations

- **Status:** accepted
- **Date:** 2026-09-23

## Context

Phase 7 gave a product its option groups. Phase 8 has to let someone actually answer them — on a product
that hides questions depending on earlier answers — and end up with something a quote can be built from.
Two failure modes matter: a price a customer sees in the browser that the server later disagrees with,
and a configuration that is "complete" while a question nobody was shown sits unanswered.

## Decision

1. **One set of pure functions, run in both places.** `packages/domain/catalog/configuration.ts`
   evaluates visibility, validates answers and prices them. The browser calls it on every keystroke for
   the live total; the server calls the same functions before saving and stores _its_ result. Nothing
   about the price travels from the client — only the answers do. A configurator that trusted the
   browser's number would be a discount anyone could grant themselves.
2. **A hidden question is not asked and not required.** Visibility is evaluated first; required-ness only
   applies to groups actually on screen. When an earlier answer changes and hides a later question, that
   answer is _dropped_ rather than rejected — someone who picks velvet, adds the care kit, then switches
   to leather has not made a mistake, and should not be told they have.
3. **Rules stay small on purpose.** A rule reads one other group's answer (`equals`, `in`, `answered`)
   and `all` / `any` / `not` compose them. That is enough for "ask about the care kit only for velvet"
   without turning a JSON column into a programming language nobody can debug. The editor writes the
   single-condition form; richer rules can be stored by hand and are still evaluated. A rule pointing at
   a missing group or a non-existent option is refused when saved, and a group can't hide behind its own
   answer — that question could never be answered.
4. **Answers cross the wire as JSON, validated against the product.** The shape depends on the product's
   own groups, so the action takes a JSON string, parses it defensively, and hands it to the repository,
   which re-reads the product and validates. Only a published product can be configured: a draft has no
   settled price.
5. **A saved configuration is a real record, not a scratch pad.** `saved_configurations` stores the
   cleaned answers, the quantity, the server's unit price and total, and the breakdown as shown. It can
   hang off a lead, which is what makes it useful before quotes exist: a salesperson configures what the
   customer wants while they are on the phone, and the lead carries it. Phase 9 turns one into a quote
   line without re-asking anything.
6. **Money stays in minor units until it is displayed.** Pricing runs through `packages/domain/money`
   (bigint cents) and `priceLine`, the same path a quote line takes, and the stored `unit_price` and
   `total` are decimal strings from that arithmetic — never a float from the browser.

## Consequences

- This phase adds the first migration since the initial schema (`20260923110423_saved_configurations`).
  The RLS foundation enables tenant isolation on every table with an `organization_id`, so the new table
  is covered without a policy change.
- The configurator re-prices on every render. That is cheap because it is pure arithmetic over a spec
  already in memory; nothing hits the network while someone is answering.
- Saved configurations are per product and per lead, not per customer. When accounts need a "standard
  spec", that is a different object and can be added without disturbing this one.
- A product's option codes are now load-bearing: a saved configuration refers to them. Renaming a
  _label_ is safe, and the code generator already guarantees codes are unique and stable per parent.
