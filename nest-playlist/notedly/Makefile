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


define ensure_yarn
cd $(1) && if [ ! -d "node_modules" ];then yarn;fi
endef


#
# Tweak the variables based on your project.
#
SERVER_DIR=$(CURRENT_DIR)/server
CLIENT_DIR=$(CURRENT_DIR)/client

DATA_ROOT=/tmp/pdata
MONGO := web-mongo
MONGO_IMAGE=mongo:4.0-xenial

# Current version of the project.

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = _check-docker _setup _start-mongo _stop-mongo clean groupdhelp help server silenthelp test 


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

_check-docker: ## wait docker up-running
	echo "waiting for docker..." && until docker system info > /dev/null 2>&1; do sleep 3; done

_start-mongo: _check-docker ## start mongo in docker
	if docker container ps -a | grep $(MONGO) &> /dev/null; then \
		sh -c "docker container start $(MONGO)"; \
	else \
		sh -c "docker run -d --name $(MONGO) -p 27017:27017 -v $(DATA_ROOT)/mongo:/data/db $(MONGO_IMAGE)"; \
	fi

_stop-mongo: ## stop mongo
	sh -c 'docker container stop $(MONGO)'

##@ Development

_setup: ## set up toolkit project
	$(call ensure_yarn,$(SERVER_DIR))

server: _setup _start-mongo ## start server in watch mode
	overmind start -l server

##@ Cleanup

test: ## test anything
	$(info $(RED)Message$(NOFORMAT))
	$(info $(CYAN)Message$(NOFORMAT))
	$(info $(WHITE)Message$(NOFORMAT))
	echo "$(CYAN)echo Message$(NOFORMAT)"


clean: ## Cleanup the project folders
	$(info $(YELLOW)Cleaning up things$(NOFORMAT))
