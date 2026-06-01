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

define ensure_yarn
cd $(1) && if [ ! -d "node_modules" ];then yarn;fi
endef

define update_yarn
cd $(1) && yarn && git status
endef

define fetch_latest
echo "$(BLUE)$(1)$(NOFORMAT)"
cd $(1) && git fetch origin && git remote prune origin
echo ""
endef

DEMO_DIR=${HOME}/workspace/examples/npm-star
EXT_PACK_DIR=${HOME}/workspace/ext-pack/mini-ext-pack

#
# Tweak the variables based on your project.
#
DATA_ROOT=~/workspace/pdata
REDIS := web-redis
REDIS_IMAGE=redis:6-alpine
MONGO := web-mongo
MONGO_IMAGE=mongo:3-xenial

# Current version of the project.


#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
targets = help groupdhelp list-help _check-docker _start-redis _start-mongo _stop-redis _stop-mongo stop-redmon clean-redmon pack test clean


# All targets.
.SILENT: $(targets)
.PHONY: $(targets)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

list-help: ## List all commands
	awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | pbcopy

##@ Utils

_check-docker: ## wait docker up-running
	echo "waiting for docker..." && until docker system info > /dev/null 2>&1; do sleep 3; done

_start-redis: _check-docker ## start redis in docker
	if docker container ps -a | grep $(REDIS) &> /dev/null; then \
		docker container start $(REDIS); \
	else \
		docker run -d --name $(REDIS) -p 6379:6379 -v $(DATA_ROOT)/redis:/data $(REDIS_IMAGE); \
	fi

_start-mongo: _check-docker ## start mongo in docker
	if docker container ps -a | grep $(MONGO) &> /dev/null; then \
		docker container start $(MONGO); \
	else \
		docker run -d --name $(MONGO) -p 27017:27017 -v $(DATA_ROOT)/mongo:/data/db $(MONGO_IMAGE); \
	fi

_stop-redis: ## stop redis
	sh -c 'docker container stop $(REDIS)'

_stop-mongo: ## stop mongo
	sh -c 'docker container stop $(MONGO)'

stop-redmon: _stop-redis _stop-mongo ## stop redis and mongo
	echo "mongo stoped, redis stoped"

clean-redmon: stop-redmon ## remove redis and mongo containers
	sh -c 'docker container rm $(REDIS) && docker container rm $(MONGO)'

##@ Setup

##@ Development

pack: clean ## test the pack function
	npx ts-node --transpile-only  test-demo.ts $(DEMO_DIR) && open $(DEMO_DIR)

pack_dist: clean build_dist ## test the distribution
	node test-demo.js $(DEMO_DIR) && open $(DEMO_DIR)

##@ Build

test: ## test anything
	$(info $(RED)Message$(NOFORMAT))
	$(info $(GREEN)Message$(NOFORMAT))
	$(info $(YELLOW)Message$(NOFORMAT))
	$(info $(BLUE)Message$(NOFORMAT))
	$(info $(MAGENTA)Message$(NOFORMAT))
	$(info $(CYAN)Message$(NOFORMAT))
	$(info $(WHITE)Message$(NOFORMAT))


##@ Cleanup

build_dist: ## build distribution
	cd $(EXT_PACK_DIR) && yarn && npm run build

clean: ## Cleanup the project folders
	rm -rf $(DEMO_DIR)/miniprogram_npm || true
