# AI model risk management

| Feature                        | Risk tier | Key risks                       | Controls                                                      | Owner                  |
| ------------------------------ | --------- | ------------------------------- | ------------------------------------------------------------- | ---------------------- |
| Copilot Q&A                    | Medium    | Wrong answers, data leakage     | Read tools under user permissions, citations, eval suite      | AI lead                |
| Action proposals (quotes, POs) | High      | Financial impact                | Proposals only, diff review, server-side pricing, audit       | Sales/Procurement lead |
| Lead scoring                   | Medium    | Bias, opaque ranking            | No protected attributes, explanation shown, fairness eval     | CRM lead               |
| Demand forecasting             | Medium    | Stock-outs or overstock         | Backtesting, confidence intervals, human approval of reorders | Operations lead        |
| Document RAG                   | Medium    | Prompt injection, stale content | Content isolation, tool allow-list, freshness metadata        | AI lead                |

## Lifecycle

**Proposal → risk tier → eval dataset → offline eval → shadow mode → limited rollout (feature flag) → monitoring → periodic review (quarterly).**

A model or prompt change is released only if its eval scores don't regress beyond the agreed tolerance.
