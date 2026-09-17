# AI EMS — developer entry points (thin wrappers around pnpm/turbo).
SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install doctor dev build check typecheck lint test test-integration e2e format \
        db-generate db-migrate db-deploy db-seed db-sql docker-build docker-up clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies and generate the Prisma client
	corepack enable
	pnpm install --frozen-lockfile
	pnpm db:generate

doctor: ## Check toolchain and .env
	node tools/developer/doctor.mjs

dev: ## Start the web app (http://localhost:3000, sandbox at /preview)
	pnpm dev

build: ## Production build of every workspace
	pnpm build

check: ## Typecheck, lint, unit tests and formatting
	pnpm check

typecheck: ## TypeScript across workspaces
	pnpm typecheck

lint: ## ESLint across workspaces
	pnpm lint

test: ## Unit and component tests
	pnpm test

test-integration: ## Database/RLS tests (needs TEST_DATABASE_URL)
	pnpm test:integration

e2e: ## Playwright end-to-end + accessibility tests
	ENABLE_UI_PREVIEW=true pnpm test:e2e

format: ## Format everything with Prettier
	pnpm format

db-generate: ## Generate the Prisma client
	pnpm db:generate

db-migrate: ## Create/apply a development migration (NAME=…)
	pnpm db:migrate --name $(or $(NAME),change)

db-deploy: ## Apply migrations + Supabase SQL (DATABASE_URL = direct connection)
	pnpm db:deploy
	infrastructure/scripts/apply-supabase-sql.sh

db-seed: ## Seed permissions and the demo tenant
	pnpm db:seed

docker-build: ## Build the production image
	docker build -f infrastructure/docker/Dockerfile -t ai-ems-web .

docker-up: ## Run app + Postgres locally
	docker compose -f infrastructure/docker/docker-compose.yml up --build

clean: ## Remove build output and dependencies
	pnpm clean
