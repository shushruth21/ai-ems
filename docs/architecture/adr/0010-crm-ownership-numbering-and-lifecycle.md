# 0010. CRM lead ownership, document numbering and lifecycle

- **Status:** accepted
- **Date:** 2026-09-23

## Context

Phase 6 is the first module that belongs to the people using it rather than to the platform: a lead has
an owner, a life of its own, and a number that will be quoted on the phone. Three questions had to be
settled before the rest of the modules copy the pattern — who may touch a record, where the record's
number comes from, and how its status is allowed to change.

## Decision

1. **Ownership is a rule, not a filter.** Everyone in the workspace can _see_ every lead; only its owner
   may change it, unless the person holds `crm.lead.assign`, which is what a sales manager's role has.
   An unassigned lead is anyone's to pick up. Hiding other people's leads would have made handovers,
   coverage and reporting worse for no security gain — the audit trail, not invisibility, is what makes
   this safe. The rule lives in `packages/domain/crm/lead-policy.ts` as pure functions, so the UI can grey
   out what won't work and the repositories can refuse it for real.
2. **Document numbers come from a locked sequence row, in the caller's transaction.**
   `nextDocumentNumber(tx, orgId, "lead")` does `SELECT … FOR UPDATE` on the tenant's `sequences` row and
   writes the next value back; the insert that uses the number is in the same transaction, so a failure
   releases the number instead of leaving a hole. Numbers are per workspace and reset each year
   (`LD-2026-00001`). The alternative — a Postgres sequence or a count — gives gaps, and gaps in a
   customer-facing number are the sort of thing an auditor asks about.
3. **The lifecycle is a table, not a pile of `if`s.** The lead machine reuses the Phase 2
   `defineMachine` helper: every legal move is a row with its `from` statuses and required permission.
   The detail page asks the machine what to offer, so the buttons can never suggest something the server
   will reject. Extra conditions stay next to it as explicit rules: qualifying needs a contact or account,
   proposing needs a value, and closing as lost or disqualified needs a reason — that reason is the only
   honest input any future win/loss analysis has.
4. **The timeline is append-only, and the lifecycle writes to it.** Every transition also writes an
   activity row, so the story of a lead reads the same whether the work was logged by hand or implied by a
   status change. The first non-note activity stamps `firstResponseAt` once: response time is a metric
   the business will want, and it can't be reconstructed later.
5. **Money and dates stay strings until the edge.** The Zod schemas validate `"12,500.50"` and
   `"2026-10-01"` as text and expose `toAmount` / `toDate` for the server action to apply. A schema that
   transformed them would hand React Hook Form a number where its input expects a string, and the form's
   own revalidation pass would then reject the values it just produced — which is exactly the bug this
   phase hit.
6. **Repositories take the tenant-scoped client.** CRM code never sees the root Prisma client: `ctx.db`
   filters every read by organization and stamps every write, with RLS behind it. The platform helpers
   (audit, outbox, sequences) take the plain client types, so `packages/db/src/crm/types.ts` re-labels the
   scoped client in one documented place instead of duplicating those helpers.
7. **Archive, don't delete.** Accounts and contacts are archived, and an account with open leads can't be
   archived at all. Quotes, orders and invoices will point at these rows for years; a delete would either
   break that history or silently orphan it.

## Consequences

- A change anywhere in the CRM revalidates the whole workspace subtree (`/<slug>`, layout). The dashboard's
  pipeline, the lists and a lead's own page all read the same rows, and guessing which paths to refresh
  produced stale numbers in exactly the way the e2e suite caught.
- The seed now creates three accounts, three contacts and three leads, so the screens have something to
  show on a fresh install; the lead sequence is moved past the seeded numbers.
- Later modules (quotes in Phase 9, orders, invoices) can take the same three decisions off the shelf:
  a policy module, `nextDocumentNumber`, and a machine — rather than re-inventing ownership and numbering
  each time.
- Reassignment notifies the new owner through the Phase 5 outbox (`lead.assigned`), and closing a lead
  emits `lead.closed` for whatever wants it later (reporting, AI scoring). The worker ignores unknown
  types, so those events are harmless until handlers exist.
