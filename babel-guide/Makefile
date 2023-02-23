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

# Current version of the project.
USER_ID=$(shell id -u)
CWD = $(shell pwd)

#
# These variables should not need tweaking.
#

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = ast1 ast2 clean example1 example1-hand example2 example2-hand groupdhelp help silenthelp

.SILENT: $(TARGETS)

# All targets.
.PHONY:  $(TARGETS)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \n  make help \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

silenthelp: ## List all commands
	@sed -i '' -E "s/^TARGETS =.*$$/TARGETS = ""$$(awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | tr " " "\n" | sort -n | tr "\n" " ")""/" $(MAKEFILE_LIST)

##@ Utils


##@ Test

example1: ## run example-1
	npx babel --config-file $(CWD)/examples/e1.babelrc --out-file $(CWD)/dist/e1.js $(CWD)/examples/e1.js

example2: ## run example-2
	npx babel --config-file $(CWD)/examples/e2.babelrc --out-file $(CWD)/dist/e2.js $(CWD)/examples/e2.js

example1-hand: ## run example-2 in hand-made
	node examples/e1.hand-babel.js

example2-hand: ## run example-2 in hand-made
	node examples/e2.hand-babel.js

ast1: ## print AST example 1
	node examples/e1.js

ast2: ## print AST example 2
	node examples/e2.js

##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)
