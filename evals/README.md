# evals/ (reserved — Phase 21)

Golden datasets and harnesses that gate AI changes in CI.

```
evals/
├── copilot/        questions → expected tools/answers, faithfulness, refusals
├── retrieval/      queries → relevant document ids (recall@k, MRR)
├── proposals/      action proposals → schema validity, correctness
└── safety/         prompt-injection & data-leak attempts
```

All datasets are synthetic, with no customer data.
