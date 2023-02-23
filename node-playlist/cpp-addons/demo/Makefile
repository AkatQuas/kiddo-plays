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
CWD = $(shell pwd)

NOFORMAT=$(shell tput sgr0)
RED:=$(shell tput setaf 1)
GREEN=$(shell tput setaf 2)
YELLOW=$(shell tput setaf 3)
BLUE=$(shell tput setaf 4)
MAGENTA=$(shell tput setaf 5)
CYAN=$(shell tput setaf 6)
WHITE=$(shell tput setaf 7)

define ensure_npx
if [ ! -x "$(shell command -v $(1))" ]; then echo "installing $(1) globally use npm" && npm install -g $(1); fi
endef


#
# Tweak the variables based on your project.
#

# Current version of the project.

TOOLKIT_DIR=$(CWD)/miniapp-toolkit
# so we can reach to the tila folder

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = _ensure_gyp _test build clean config groupdhelp help silenthelp test

ADDONS = hello adder


# All targets.
.SILENT: $(targets)
.PHONY: $(targets)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

silenthelp: ## List all commands
	@sed -i '' -E "s/^targets =.*$$/TARGETS = ""$$(awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | tr " " "\n" | sort -n | tr "\n" " ")""/" $(MAKEFILE_LIST)

##@ Setup

_ensure_gyp: ## ensure node-gyp is globally installed
	$(call ensure_npx, node-gyp)

##@ Development

config: _ensure_gyp ## config bindings using node-gyp
	node-gyp --silent configure

build: config ## build addons using node-gyp
	node-gyp build

test: build ## test addons in node js
	echo ""
	echo ""
	echo "$(YELLOW)Starting test$(NOFORMAT)"
	for f in $(ADDONS) ; do \
		file=$(CWD)/$${f}/$${f}.test.js; \
		node $${file}; \
	done; \
	echo "$(GREEN)All test passed$(NOFORMAT)"

##@ Build

_test: ## test anything
	$(info $(RED)Message$(NOFORMAT))
	$(info $(GREEN)Message$(NOFORMAT))
	$(info $(YELLOW)Message$(NOFORMAT))
	$(info $(BLUE)Message$(NOFORMAT))
	$(info $(MAGENTA)Message$(NOFORMAT))
	$(info $(CYAN)Message$(NOFORMAT))
	$(info $(WHITE)Message$(NOFORMAT))

##@ Cleanup

clean: ## Cleanup the project folders
	echo "$(YELLOW)Cleaning up things$(NOFORMAT)"
	node-gyp clean
