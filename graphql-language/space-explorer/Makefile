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
CURRENT_DIR=$(shell pwd)

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help

# All targets.
.PHONY: install cleanup dev
.SILENT: install cleanup dev

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Installation

install: ## install required modules
	for f in client server; do \
		target=$${f}/$(NODE_DIR); \
		if [ ! -d $${target} ]; then \
			echo $${f}; \
			pushd $${f} && yarn && popd; \
		fi; \
	done; \
	echo "Installation Complete";

cleanup: ## clean up node_modules
	for f in client server; do \
		target=$${f}/$(NODE_DIR); \
		if [ -d $${target} ]; then \
		 	echo "cleaning in $${f}"; \
		 	rm -rf $${target}; \
		fi; \
		echo "Cleanup Complete"; \
	done

##@ Development

dev:  ## using Procfile to start development
	sh -c 'overmind start'
