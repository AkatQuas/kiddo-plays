# Copyright 2020 AkatQuas
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
NODE_DIR := node_modules

# Current version of the project.

#
# These variables should not need tweaking.
#

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help

# All targets.
.PHONY: install cleanup dev
.SILENT: install cleanup dev

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Installation

install: ## install required modules
	{ \
		if [ ! -d "client/${NODE_DIR}" ]; then \
			sh -c 'cd client && yarn'; \
		fi; \
		if [ ! -d "server/${NODE_DIR}" ]; then \
			sh -c 'cd server && yarn'; \
		fi; \
		echo "Installation Complete"; \
	}

cleanup: ## clean up node_modules
	{ \
		if [ -d "client/${NODE_DIR}" ]; then \
			echo "cleaning in client"; \
			sh -c 'rm -rf "client/${NODE_DIR}"'; \
		fi; \
		if [ -d "server/${NODE_DIR}" ]; then \
			echo "cleaning in server"; \
			sh -c 'rm -rf "server/${NODE_DIR}"'; \
		fi; \
		echo "Cleanup Complete"; \
	}

##@ Development

dev:  ## using Procfile to start development
	sh -c 'overmind start'
