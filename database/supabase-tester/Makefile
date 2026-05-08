# Copyright 2020 The AkatQuas
#
# The old school Makefile, following are required targets. The Makefile is written
# to allow building multiple images. You are free to add more targets or change
# existing implementations, as long as the semantics are preserved.
#
#
# The makefile is also responsible to populate project version information.
#

#
# Tweak the variables based on your project.
#

# Project name
PROJECT := supabase-tester

# Current version of the project.

#
# These variables should not need tweaking.
#

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = check-docker clean clean-node docker-down docker-logs docker-restart docker-up groupdhelp help install silenthelp start start-dev test test-watch


.SILENT: $(TARGETS)
# All targets.
.PHONY:  $(TARGETS)

##@ Utils

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

silenthelp: ## silent the targets
	@ sed -i '' -E "s/^TARGETS =.*$$/TARGETS = ""$$(awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | tr " " "\n" | sort -n | tr "\n" " ")""/" $(MAKEFILE_LIST)


##@ Development

check-docker: ## wait docker up-running
	echo "waiting for docker..." && until docker system info > /dev/null 2>&1; do sleep 2; done

##@ Docker

# Docker files location
DOCKER_DIR := docker
DOCKER_COMPOSE := $(DOCKER_DIR)/docker-compose.yml

docker-up: check-docker ## Start Supabase services
	cd $(DOCKER_DIR) && docker-compose up -d
	@echo "Waiting for services to be ready..."
	@sleep 5

docker-down: ## Stop Supabase services
	cd $(DOCKER_DIR) && docker-compose down

docker-restart: ## Restart Supabase services
	cd $(DOCKER_DIR) && docker-compose restart

docker-logs: ## View Supabase logs
	cd $(DOCKER_DIR) && docker-compose logs -f

docker-build: ## Build Docker images
	cd $(DOCKER_DIR) && docker-compose build

##@ Dependencies

install: ## Install node dependencies
	pnpm install

##@ Server

start: ## Start the Express server
	pnpm start

start-dev: ## Start the Express server with hot reload
	npx nodemon src/index.js

##@ Tests

test: ## Run tests
	pnpm test

test-watch: ## Run tests in watch mode
	pnpm test -- --watch

##@ Cleanup

clean: ## Stop containers and remove volumes
	cd $(DOCKER_DIR) && docker-compose down -v

clean-node: ## Remove node_modules
	rm -rf node_modules pnpm-lock.yaml
# claude --resume ffef888d-7938-4096-b714-577437819ad8
