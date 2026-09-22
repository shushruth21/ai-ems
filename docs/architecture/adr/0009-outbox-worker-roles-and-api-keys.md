# 0009. Transactional outbox, custom roles and workspace API keys

- **Status:** accepted
- **Date:** 2026-09-22

## Context

Phase 5 adds the parts of the platform that outlive a single request: telling people what happened
(in-app and by email), letting a workspace shape its own roles, showing the audit trail that earlier
phases have been writing, and giving machines a way in. Each of these has a failure mode worth deciding
about up front — a notification sent for a change that later rolled back, a role that quietly grants its
author more power than they had, an audit query that skips rows while new ones arrive, a key that can be
recognised in a log but not reversed.

## Decision

1. **A transactional outbox, not in-request side effects.** Repositories append an `outbox_events` row in
   the same transaction as the change that caused it (`member.joined` with the membership, `security.changed`
   with the setting). A separate process (`tools/worker`) turns events into notifications and email. A
   notification therefore can't exist for a change that rolled back, and can't be lost if the web process
   dies between commit and send. The alternative — awaiting SMTP inside a server action — couples a user's
   click to a third party's latency and leaves no record when it fails.
2. **Claiming with `FOR UPDATE SKIP LOCKED`.** A batch is claimed by one `update … where id in (select …
for update skip locked)` statement, so several worker replicas can run without handing the same event to
   two of them and without a distributed lock service. Failures set `PENDING` again with exponential
   backoff (10s, 20s, 40s …, capped at an hour) and are parked as `FAILED` after 8 attempts; events stuck in
   `PROCESSING` (a worker that died mid-flight) are requeued after five minutes. Events whose type no
   handler knows are completed and logged rather than retried forever, so a rollback of the web app can't
   wedge the queue.
3. **Email never fails a job.** `packages/mail` exposes one `Mailer` with four transports — `log`, `none`,
   `smtp` (nodemailer), `resend` (HTTP) — and `send()` resolves with `delivered: false` instead of throwing.
   A bounced message must not re-run a handler, because that would duplicate the in-app notification, which
   is the delivery of record. Recipients are never written to logs.
4. **Custom roles can't escalate.** `packages/domain/organization/role-policy.ts` is a pure function over
   the editor's own permissions: a permission may only be added to a role if the editor holds it, and — the
   case that is easy to miss — may only be _removed_ if the editor holds it, so a narrow role can't quietly
   strip powers it can't see. System roles are read-only, a role with members can't be deleted, and a
   workspace is capped at 30 custom roles. The checkboxes in the UI mirror the rule; the server applies it
   again inside the transaction.
5. **The audit log is keyset-paginated on its bigint id**, never by offset. Rows arrive constantly, and an
   offset page would skip or repeat entries as they do. Filters (action, entity type, date range) are
   validated with the same Zod contract the UI uses, and a page reads `take + 1` rows to learn whether
   another page exists without a second count query.
6. **API keys are `aiems_<12 hex prefix>_<43-char secret>`.** Only the SHA-256 of the whole token is
   stored, with the prefix in the clear so a key can be named in a list or a log line; verification looks
   the row up by prefix and then compares hashes with `timingSafeEqual`. The prefix is hex on purpose: the
   secret half is base64url and may itself contain `_`, so a token can't be split on underscores. Keys are
   workspace-scoped — a request never names the organization it wants, it gets the one the key belongs to
   — carry `read`/`write` scopes, may expire, and record `lastUsedAt` at most once a minute so a busy
   integration doesn't cost a write per request. Unknown, revoked and expired keys all answer `401` with
   the same body.
7. **Notifications belong to their recipient.** Every read and write is scoped by `(organizationId,
recipientId)`, so one member can't mark another's notification read by guessing an id.

## Consequences

- Deployments now include a worker process. It is idempotent and horizontally scalable; `WORKER_HEALTH_PORT`
  exposes `GET /healthz` with queue counts for container probes. `pnpm dev:local` and the Playwright config
  both start one, so local and CI runs exercise the same path as production.
- An event type must exist in the worker before the web app enqueues it, or the first events after a deploy
  are skipped (logged, not lost data — the change itself committed).
- The outbox table grows; a retention job for `DONE` rows (and for `audit_events`) is Phase 5's follow-up
  in the operations runbooks.
- Adding a permission to `PERMISSIONS` requires a seed of the `permissions` table before roles can use it.
