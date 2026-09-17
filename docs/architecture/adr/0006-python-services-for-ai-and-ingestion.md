# 0006. Python services for AI orchestration, ingestion and forecasting

- **Status:** proposed (implement in Phases 20–21)
- **Date:** 2026-09-17

## Context

RAG ingestion (document parsing and OCR), forecasting and evaluation tooling are strongest in the Python ecosystem. The web app should stay TypeScript.

## Decision

Add `services/ai-service` and `services/ingestion-service`, built with FastAPI and uv. Each uses a clean-architecture layout: `api/ application/ domain/ infrastructure/`.

- **Communication:** HTTPS with service tokens, plus outbox events.
- **Contracts:** OpenAPI and JSON Schema generated from `packages/contracts`.
- **Vectors:** pgvector in the same Supabase Postgres, with tenant-scoped collections.
- **Supporting code:** ML models and pipelines live in `ml/`, and evaluation datasets in `evals/`.

## Consequences

- There will be two toolchains (pnpm and uv) in CI.
- Contract tests between the web app and these services become mandatory.
