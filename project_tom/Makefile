
# Copyright 2020 The AkatQuas
#
# The old school Makefile, following are required targets. The Makefile is written
# to allow building multiple images. You are free to add more targets or change
# existing implementations, as long as the semantics are preserved.
#
#
# These variables should not need tweaking.
#
VERSION_BY_DATE = $(shell date +v"%Y%m%d")
USER_ID=$(shell id -u)
CURRENT_DIR = $(shell pwd)

COMMIT_SHA=$(shell git rev-parse --short HEAD)

NOFORMAT=$(shell tput sgr0)
RED:=$(shell tput setaf 1)
GREEN=$(shell tput setaf 2)
YELLOW=$(shell tput setaf 3)
BLUE=$(shell tput setaf 4)
MAGENTA=$(shell tput setaf 5)
CYAN=$(shell tput setaf 6)
WHITE=$(shell tput setaf 7)

define require_command
@command -v $(1) >/dev/null 2>&1 || { echo >&2 "error: '$(1)' is required but not installed. Please install '$(1)' and try again."; exit 1; }
endef

define open_web
# echo "$(BLUE)open $(1) $(NOFORMAT)"
sh -c '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --profile-directory=Profile\ 1 "$(1)" > /dev/null 2>&1 & disown'
endef

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = _check-docker clean dashboard dev ensure_overmind format_package_json groupdhelp help silenthelp 


.SILENT: $(TARGETS)

# All targets.
.PHONY:  $(TARGETS)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \n  make help \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

silenthelp: ## silent the targets
	@ sed -i '' -E "s/^TARGETS =.*$$/TARGETS = ""$$(awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | tr " " "\n" | sort -n | tr "\n" " ")""/" $(MAKEFILE_LIST)

##@ Utils

_check-docker: ## wait docker up-running
	echo "waiting for docker..." && until docker system info > /dev/null 2>&1; do sleep 3; done

##@ Development

dashboard: ## checkout the sprint dashboard
	$(call open_web, "https://jerry.ai/internal/devops/dashboard")

dev: ensure_overmind ## start to development
	overmind start

##@ Test


##@ Chore

ensure_overmind: ## ensure overmind is available
	command -v overmind > /dev/null 2>&1 || { echo "$(YELLOW)Installing overmind using homebrew...$(NOFORMAT)" &&  brew install overmind; }

format_package_json: ## format package json files
	./node_modules/.bin/sort-package-json **/package.json

clean: ## Cleanup the project folders
	$(info Cleaning up things)
	git clean -xdf
