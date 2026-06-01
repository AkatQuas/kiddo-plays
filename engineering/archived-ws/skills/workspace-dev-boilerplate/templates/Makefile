# Workspace shell Makefile
# Paths: define in .env or here as make variables reading from .env

CWD = $(shell pwd)
NOFORMAT=$(shell tput sgr0)
BLUE=$(shell tput setaf 4)

# Example — align with .env (or export from .env via overmind/shell)
APP_DIR=$(CWD)/app

define ensure_yarn
cd $(1) && if [ ! -d "node_modules" ]; then yarn; fi
endef

define fetch_latest
echo "$(BLUE)$(1)$(NOFORMAT)"
cd $(1) && git fetch origin && git remote prune origin
endef

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
targets = help groupdhelp proc_list gfo app_setup dev

.SILENT: $(targets)
.PHONY: $(targets)

help: ## List targets
	@awk 'BEGIN {FS = ":.*##"; printf "\n  make \033[36m<target>\033[0m\n\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp: ## Grouped help
	@awk 'BEGIN {FS = ":.*##"} /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Setup

app_setup: ## Install dependencies (customize path)
	$(call ensure_yarn,$(APP_DIR))

gfo: ## Git fetch in app repo
	$(call fetch_latest,$(APP_DIR))

##@ Development

proc_list: ## List Procfile process names
	echo "$$(awk 'BEGIN {FS = ":"} /^[^#[:space:]].*:[[:space:]]*/ {print $$1}' ./Procfile)"

dev: proc_list ## Start Overmind (edit process list to match Procfile)
	overmind start -l dev
