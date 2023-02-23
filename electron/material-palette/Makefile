
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
# These variables should not need tweaking.
#
VERSION_BY_DATE = $(shell date +v"%Y%m%d")
USER_ID=$(shell id -u)
CURRENT_DIR = $(shell pwd)

NOFORMAT=$(shell tput sgr0)
RED:=$(shell tput setaf 1)
GREEN=$(shell tput setaf 2)
YELLOW=$(shell tput setaf 3)
BLUE=$(shell tput setaf 4)
MAGENTA=$(shell tput setaf 5)
CYAN=$(shell tput setaf 6)
WHITE=$(shell tput setaf 7)

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = _clean_build dev groupdhelp help silenthelp test 


.SILENT: $(TARGETS)

# All targets.
.PHONY:  $(TARGETS)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \n  make help \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

silenthelp: ## List all commands
	@sed -i '' -E "s/^TARGETS =.*$$/TARGETS = ""$$(awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | tr " " "\n" | sort -n | tr "\n" " ")""/" $(MAKEFILE_LIST)

##@ Development

dev: _clean_build ## Development
	overmind start

##@ Cleanup

_clean_build: ## Clean up build output
	rm -rf build

test: ## test anything
	$(info $(RED)Message$(NOFORMAT))
	$(info $(GREEN)Message$(NOFORMAT))
	$(info $(YELLOW)Message$(NOFORMAT))
	$(info $(BLUE)Message$(NOFORMAT))
	$(info $(MAGENTA)Message$(NOFORMAT))
	$(info $(CYAN)Message$(NOFORMAT))
	$(info $(WHITE)Message$(NOFORMAT))
	echo "$(CYAN)echo Message$(NOFORMAT)"
