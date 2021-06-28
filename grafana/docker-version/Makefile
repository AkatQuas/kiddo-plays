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
DATA_ROOT=~/workspace/pdata
GRAFANA_CONTAINER=grafana
GRAFANA_IMAGE=grafana/grafana:7.2.1

# Current version of the project.

VERSION_BY_DATE = $(shell date +v"%Y%m%d")

#
# These variables should not need tweaking.
#
USER_ID=$(shell id -u)
CURRENT_DIR = $(shell pwd)
#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = help groupdhelp list-help _check-docker start-grafana clean


.SILENT: $(TARGETS)

# All targets.
.PHONY:  $(TARGETS)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \n  make help \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

list-help: ## List all commands
	awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | pbcopy

##@ Utils

_check-docker: ## wait docker up-running
	echo "waiting for docker..." && until docker system info > /dev/null 2>&1; do sleep 3; done

start-grafana: _check-docker ## start redis in docker
	if docker container ps -a | grep $(GRAFANA_CONTAINER) &> /dev/null; then \
		sh -c "docker container start $(GRAFANA_CONTAINER)"; \
	else \
		sh -c "docker run -d --user $(USER_ID) --name $(GRAFANA_CONTAINER) -v $(DATA_ROOT)/grafana:/var/lib/grafana -v $(CURRENT_DIR)/conf:/etc/grafana  -p 4400:3000 $(GRAFANA_IMAGE) && open http://localhost:4400"; \
	fi

##@ Development

test:
	echo $(USER_ID)

##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)
