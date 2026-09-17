# ml/ (reserved — Phase 20)

Forecasting and scoring models for AI EMS. There is no vision, ranking or generic NLP scaffolding: only what the product needs.

```
ml/
├── forecasting/      demand & stock prediction (pipelines, features, training, batch scoring)
├── scoring/          lead / partner scoring (fairness-evaluated)
├── evaluation/       backtests, bias & fairness checks, model cards
└── notebooks/        exploration only — never imported by services
```

Model cards and risk tiers are tracked in [docs/governance/ai-model-risk.md](../docs/governance/ai-model-risk.md).
