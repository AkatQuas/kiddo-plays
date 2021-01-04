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
DATE ?= $(shell date)
FILES = $(shell ls)
PROJECTS = nextjs-home nextjs-blog
PREFIX = rub

#
# These variables should not need tweaking.
#

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help

# All targets.
.PHONY:

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Utils

date: ## Show Files
	sh -c 'echo $(FILES)'

files: ## echo file with extension
	@for target in $(FILES); do                                \
		ext=$(PREFIX)$${target};                                 \
		echo $${target}-$${ext};                                 \
	done

##@ Dependencies

deps:  ## Check dependencies
	$(info yarn)

##@ Development

dev: ## development
	sh -c 'overmind start'

##@ Build

build: ## Build the project
	@for target in $(PROJECTS); do \
		sh -c 'cd $${target} && npx next build';		\
	done
