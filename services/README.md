# services/ (reserved — Phases 20–21)

Python services join here as a **uv workspace** (`services/pyproject.toml`). See [ADR 0006](../docs/architecture/adr/0006-python-services-for-ai-and-ingestion.md).

```
services/
├── pyproject.toml            uv workspace root
├── ai-service/               FastAPI · copilot orchestration · RAG retrieval · forecasting API
│   └── src/ai_service/{api,application,domain,infrastructure}/  main.py
└── ingestion-service/        connectors → extract → normalize → redact → chunk → embed → index
```

Each service ships with:

- a `Dockerfile`
- contract tests against `docs/api/openapi.yaml`
- an entry in `.github/workflows/ci.yml` (`uv sync --frozen && uv run pytest`)
