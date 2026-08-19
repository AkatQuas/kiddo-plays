SHELL := /bin/bash
.DEFAULT_GOAL := help

DB_USER ?= pgplay
DB_NAME ?= pgplayground
DB_PORT ?= 5432

##@ Setup

install: ## Install all npm dependencies
	cd server && npm install
	cd web && npm install

##@ Development

dev: ## Start dev environment (postgres in Docker, server + web locally)
	docker compose up -d postgres
	@echo "Waiting for postgres..."
	@until docker compose exec -T postgres pg_isready -U $(DB_USER) -d $(DB_NAME) >/dev/null 2>&1; do sleep 1; done
	overmind start

##@ Production

build: ## Build production Docker images
	docker compose build

up: ## Start all production containers
	docker compose up -d

down: ## Stop all containers
	docker compose down

logs: ## View container logs (use ARGS="-f" to follow)
	docker compose logs $(ARGS)

##@ Database

db-shell: ## Open psql shell
	docker compose exec postgres psql -U $(DB_USER) -d $(DB_NAME)

db-reset: ## Reset database (delete volume and reinitialize)
	docker compose down -v
	docker compose up -d postgres
	@echo "Database reset complete."

##@ Quality

test: ## Run backend unit tests
	cd server && npm test

lint: ## Run ESLint on frontend and backend
	cd server && npm run lint
	cd web && npm run lint

help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)

.PHONY: install dev build up down logs db-shell db-reset test lint help
