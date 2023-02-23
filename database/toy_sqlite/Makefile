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
USER_ID=$(shell id -u)
CWD = $(shell pwd)

#
# Tweak the variables based on your project.
#

# Current version of the project.


#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = b-tree clean groupdhelp help in-disk in-memory repl setup_rspec silenthelp simple-command tree-node with-cursor


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

setup_rspec: ## install rspec locally
	bundle install --binstubs --path vendor/bundle

##@ Build

repl: ## build a repl db
	gcc db-repl.c -o exe_db-repl

simple-command: ## build a simple command
	gcc db-simple-command.c -o exe_db-simple-command

in-memory: ## build a simple in memory db
	gcc db-in-memory.c -o exe_db-in-memory

in-disk: ## build a simple disk storage db
	gcc db-in-disk.c -o exe_db-in-disk

with-cursor: ## build a db with cursor abstraction
	gcc db-with-cursor.c -o exe_db-with-cursor

tree-node: ## build a db with tree-node format
	gcc db-tree-node.c -o exe_db-tree-node

b-tree: ## build a db with b-tree format
	gcc db-b-tree.c -o exe_db-b-tree

##@ Test

test: repl simple-command in-memory in-disk with-cursor tree-node b-tree# test several db
	bin/bundle exec rspec; make clean

##@ Cleanup

clean: ## Cleanup the project folders
	rm -f exe_* *.db
