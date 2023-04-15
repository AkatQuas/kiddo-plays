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
VERSION_BY_DATE = $(shell date +v"%Y%m%d")
CWD = $(shell pwd)

# https://linuxcommand.org/lc3_adv_tput.php
# bold
BOLD_ON=$(shell tput bold)
# high-contrast output
STD_OUT_ON=$(shell tput smso)
STD_OUT_OFF=$(shell tput rmso)
# underline decroations
UNDERLINE_ON=$(shell tput smul)
UNDERLINE_OFF=$(shell tput rmul)
# clear all attributes
NOFORMAT=$(shell tput sgr0)
# foreground colors
RED:=$(shell tput setaf 1)
GREEN=$(shell tput setaf 2)
YELLOW=$(shell tput setaf 3)
BLUE=$(shell tput setaf 4)
MAGENTA=$(shell tput setaf 5)
CYAN=$(shell tput setaf 6)
WHITE=$(shell tput setaf 7)
# background colors
BG_RED:=$(shell tput setab 1)
BG_GREEN=$(shell tput setab 2)
BG_YELLOW=$(shell tput setab 3)
BG_BLUE=$(shell tput setab 4)
BG_MAGENTA=$(shell tput setab 5)
BG_CYAN=$(shell tput setab 6)
BG_WHITE=$(shell tput setab 7)

#
# Tweak the variables based on your project.
#
DATA_ROOT=/data
REDIS := local_redis
REDIS_IMAGE=redis:latest
MONGO := local_mongo
MONGO_IMAGE=mongo:latest

# Current version of the project.

# project version
VERSION = 0.0.1
# using git tags
VERSION_IN_GIT = $(shell git describe --tags --always --dirty)

AUTHOR = AkatQuas
EMAIL = example@bt.com

define ensure_yarn
cd $(1) && if [ ! -d "node_modules" ];then yarn;fi
endef

define ensure_npx
if [ -x "$(shell command -v $(1))" ]; then echo "SUCCESS: $(1) is installed"; else echo "installing $(1) globally use npm" && npm install -g $(1); fi
endef

define clean_npx
if command -v $(1) > /dev/null; then npm uninstall -g $(1); fi
endef

define fetch_latest
cd $(1) && git fetch origin && git remote prune origin
endef

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = _check_docker _list_images _start-mongo _start-redis _stop-mongo _stop-redis build clean clean-redmon develop groupdhelp help silenthelp start-redmon stop-redmon test


# All targets.
.SILENT: $(targets)
.PHONY: $(targets)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

silenthelp: ## List all commands
	@sed -i '' -E "s/^TARGETS =.*$$/TARGETS = ""$$(awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | tr " " "\n" | sort -n | tr "\n" " ")""/" $(MAKEFILE_LIST)

##@ Utils

_check_docker: ## wait docker up-running
	echo "connecting to docker..." && until docker system info > /dev/null 2>&1; do sleep 2; done

_list_images: ## list the images
	for image in $(REDIS_IMAGE) $(MONGO_IMAGE); do \
		echo $${image}; \
	done

_start-redis: _check_docker ## start redis in docker
	if docker container ps -a | grep $(REDIS) &> /dev/null; then \
		sh -c "docker container start $(REDIS)"; \
	else \
		sh -c "docker run -d --name $(REDIS) -p 6379:6379 -v $(DATA_ROOT)/redis:/data $(REDIS_IMAGE)"; \
	fi

_start-mongo: _check_docker  ## start mongo in docker
	if docker container ps -a | grep $(MONGO) &> /dev/null; then \
		sh -c "docker container start $(MONGO)"; \
	else \
		sh -c 'docker run -d --name $(MONGO) -p 27017:27017 -v $(DATA_ROOT)/mongo:/data/db $(MONGO_IMAGE)'
	fi

start-redmon: _start-redis _start-mongo ## start redis and mongo
	echo "mongo and redis started"

_stop-redis: ## stop redis
	sh -c 'docker container stop $(REDIS)'

_stop-mongo: ## stop mongo
	sh -c 'docker container stop $(MONGO)'

stop-redmon: _stop-redis _stop-mongo ## stop redis and mongo
	echo "mongo stoped, redis stoped"

clean-redmon: stop-redmon ## remove redis and mongo containers
	sh -c 'docker container rm $(REDIS) && docker container rm $(MONGO)'

##@ Development

develop: ## using Procfile to start development
	sh -c 'yarn start'

build: _check_docker ## build the distribution
	sh -c './build.sh'

test: ## just for test makefile commands
	$(info $(RED)Message$(NOFORMAT))
	$(info $(GREEN)Message$(NOFORMAT))
	$(info $(YELLOW)Message$(NOFORMAT))
	$(info $(BLUE)Message$(NOFORMAT))
	$(info $(MAGENTA)Message$(NOFORMAT))
	$(info $(CYAN)Message$(NOFORMAT))
	$(info $(WHITE)Message$(NOFORMAT))
	$(info $(BG_RED)Message$(NOFORMAT))
	$(info $(BG_GREEN)Message$(NOFORMAT))
	$(info $(BG_YELLOW)Message$(NOFORMAT))
	$(info $(BG_BLUE)Message$(NOFORMAT))
	$(info $(BG_MAGENTA)Message$(NOFORMAT))
	$(info $(BG_CYAN)Message$(NOFORMAT))
	$(info $(BG_WHITE)Message$(NOFORMAT))
	$(info $(BOLD_ON)Bold Message$(NOFORMAT))
	$(info $(STD_OUT_ON)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(RED)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(GREEN)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(YELLOW)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(BLUE)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(MAGENTA)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(CYAN)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(WHITE)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(BG_RED)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(BG_GREEN)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(BG_YELLOW)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(BG_BLUE)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(BG_MAGENTA)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(BG_CYAN)STD Message$(NOFORMAT))
	$(info $(STD_OUT_ON)$(BG_WHITE)STD Message$(NOFORMAT))

##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)
