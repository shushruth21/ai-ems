# Service level objectives

| SLI                       | Measurement                                                           | SLO (30 days)      | Error budget |
| ------------------------- | --------------------------------------------------------------------- | ------------------ | ------------ |
| Availability              | Successful `/api/health?deep=1` probes (1-minute interval, 3 regions) | 99.9%              | 43 min       |
| Page latency              | p75 server response for authenticated pages                           | < 800 ms           | —            |
| Web vitals                | p75 LCP / INP (Vercel Speed Insights)                                 | < 2.0 s / < 200 ms | —            |
| Write success             | Server actions without a 5xx                                          | 99.95%             | —            |
| Auth                      | Successful sign-in attempts that aren't user errors                   | 99.9%              | —            |
| Background jobs (Phase 5) | Outbox events processed in under 60 s                                 | 99%                | —            |

## Error budget policy

- **Budget above 50% remaining:** feature work continues normally.
- **Budget 0–50%:** reliability work gets priority in the next sprint.
- **Budget exhausted:** feature freeze except for fixes, until the budget recovers.

## Alerting

Page on-call when availability burns budget 14× faster than sustainable over 1 hour, or 6× over 6 hours. Open a ticket at 1× over 3 days.
