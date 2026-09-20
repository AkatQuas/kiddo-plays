.PHONY: help install \
        dev dev-redis dev-server dev-client build preview \
        deploy deploy-down deploy-logs deploy-build test-e2e

help:
	@echo "Development — Redis in Docker, frontend/backend on host:"
	@echo "  make dev            Redis + both apps (npm run dev via turbo)"
	@echo "  make dev-redis      Redis container only"
	@echo "  make dev-server     Express only  (:3000)"
	@echo "  make dev-client     Vite only      (:5173)"
	@echo ""
	@echo "Deploy — full stack in Docker Compose:"
	@echo "  make deploy         app + redis  → http://localhost:3000"
	@echo "  make deploy-down    stop deploy stack"
	@echo "  make deploy-logs    tail app logs"
	@echo "  make deploy-build   rebuild app image"
	@echo ""
	@echo "Other:"
	@echo "  make install        npm install"
	@echo "  make build          build client dist/"
	@echo "  make preview        host prod preview (:3000, needs dev-redis)"
	@echo "  make test-e2e       Playwright full-chain test (needs make dev)"

# ── Development ──────────────────────────────────────────────

dev-redis:
	npm run dev:redis

dev-server:
	npm run dev:server

dev-client:
	npm run dev:client

dev: dev-redis
	npm run dev

install:
	npm install

build:
	npm run build

preview: dev-redis
	npm run preview:host

# ── Deploy ───────────────────────────────────────────────────

deploy:
	npm run deploy:up

deploy-down:
	npm run deploy:down

deploy-logs:
	npm run deploy:logs

deploy-build:
	npm run deploy:build

# ── Test ─────────────────────────────────────────────────────

test-e2e:
	npm run test:e2e
