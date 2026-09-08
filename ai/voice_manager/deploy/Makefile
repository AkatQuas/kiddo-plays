SHELL := /bin/bash
.DEFAULT_GOAL := help

DEPLOY_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
PROJECT_ROOT := $(abspath $(DEPLOY_DIR)/..)
COMPOSE ?= docker compose
BASE_COMPOSE ?= -f $(DEPLOY_DIR)/docker-compose.yml
APP_COMPOSE ?= -f $(DEPLOY_DIR)/docker-compose.yml -f $(DEPLOY_DIR)/docker-compose.app.yml
DEV_COMPOSE ?= -f $(DEPLOY_DIR)/docker-compose.yml -f $(DEPLOY_DIR)/docker-compose.dev.yml
PROFILES ?= --profile infra --profile app

.PHONY: help
help: ## Show available targets
	@grep -E '^[a-zA-Z0-9_.-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  %-18s %s\n", $$1, $$2}'

.PHONY: demo-up
demo-up: ## Deploy full local demo stack (build image)
	$(COMPOSE) --project-directory $(PROJECT_ROOT) $(APP_COMPOSE) $(PROFILES) up --build -d

.PHONY: demo-down
demo-down: ## Stop demo stack
	$(COMPOSE) --project-directory $(PROJECT_ROOT) $(APP_COMPOSE) $(PROFILES) down

.PHONY: dev-up
dev-up: ## Local infra: docker postgres+minio, mount code + reload
	$(COMPOSE) --project-directory $(PROJECT_ROOT) $(DEV_COMPOSE) $(PROFILES) up

.PHONY: dev-app
dev-app: ## Test infra: app container only, set DATABASE_URL/MINIO_* in .env
	COMPOSE_PROFILES=app $(COMPOSE) --project-directory $(PROJECT_ROOT) -f $(DEPLOY_DIR)/docker-compose.dev.yml --profile app up

.PHONY: logs
logs: ## Tail voice-manager logs
	$(COMPOSE) --project-directory $(PROJECT_ROOT) $(APP_COMPOSE) logs -f voice-manager

.PHONY: ps
ps: ## Show compose service status
	$(COMPOSE) --project-directory $(PROJECT_ROOT) $(APP_COMPOSE) $(PROFILES) ps
