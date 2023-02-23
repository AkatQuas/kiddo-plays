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

#
# These variables should not need tweaking.
#

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = bootstrap bump-version changed clean clean-env groupdhelp help install-env install-lerna link list silenthelp start-env

# All targets.
.SILENT: $(targets)
.PHONY: $(targets)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

silenthelp: ## List all commands
	@sed -i '' -E "s/^targets =.*$$/TARGETS = ""$$(awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | tr " " "\n" | sort -n | tr "\n" " ")""/" $(MAKEFILE_LIST) && echo "copied"

##@ Utils

install-lerna: ## install lerna globally via npm
	npm install -g lerna@^4.0.0

install-env: ## docker pull images
	docker compose build && mkdir -p ./dist/verdaccio ./dist/gitea

bootstrap: ## Link local packages together and install remaining package dependencies
	npx lerna bootstrap

##@ Development

start-env: ## start verdaccio in docker
	docker-compose up --build --detach

link: ## Symlink together all packages that are dependencies of each other
	npx lerna link

list: ## List local packages
	npx lerna list

changed: ## List local packages that have changed since the last tagged release
	npx	lerna changed

##@ Publish

bump-version: ##  Bump version of packages changed since the last release
	npx lerna version

##@ Cleanup

clean: ## Cleanup the project folders
	npx lerna clean

clean-env: ## stop containers
	docker-compose down
