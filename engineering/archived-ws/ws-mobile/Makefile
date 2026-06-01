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
REDIS := web-redis
REDIS_IMAGE=redis:6-alpine
MONGO := web-mongo
MONGO_IMAGE=mongo:3-xenial

# Current version of the project.

#
# These variables should not need tweaking.
#
VERSION_BY_DATE = $(shell date +v"%Y%m%d")
USER_ID=$(shell id -u)
CWD = $(shell pwd)

CARGO_REGISTRY=infinitus.cargo.io

INSGIHT_WEB_DIR=insight-web

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
targets = help groupdhelp list-help _check-docker _start-redis _start-mongo _stop-redis _stop-mongo stop-redmon clean-redmon start-fe start-profile start-comment start-answer start-detail start-ui-demo start-amos ssh-remote build-utils build-ui-kits clean


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
		sh -c "docker container start $(REDIS)"; \
	else \
		sh -c "docker run -d --name $(REDIS) -p 6379:6379 -v $(DATA_ROOT)/redis:/data $(REDIS_IMAGE)"; \
	fi

_start-mongo: _check-docker ## start mongo in docker
	if docker container ps -a | grep $(MONGO) &> /dev/null; then \
		sh -c "docker container start $(MONGO)"; \
	else \
		sh -c "docker run -d --name $(MONGO) -p 27017:27017 -v $(DATA_ROOT)/mongo:/data/db $(MONGO_IMAGE)"; \
	fi

_stop-redis: ## stop redis
	sh -c 'docker container stop $(REDIS)'

_stop-mongo: ## stop mongo
	sh -c 'docker container stop $(MONGO)'

stop-redmon: _stop-redis _stop-mongo ## stop redis and mongo
	echo "mongo stoped, redis stoped"

clean-redmon: stop-redmon ## remove redis and mongo containers
	sh -c 'docker container rm $(REDIS) && docker container rm $(MONGO)'

##@ Development

start-fe: ## start local dev, go_mobile_detail_fe
	sh -c 'overmind start -l fe'

start-profile: build-utils ## start local dev, profile_web
	sh -c 'overmind start -l profile,profile-web'

start-comment: build-utils ## start local dev, comment_web
	sh -c 'overmind start -l comment,comment-web'

start-answer: build-utils ## start local dev, answer-list
	sh -c 'overmind start -l answer'

start-detail: build-utils ## start local dev, detail
	sh -c 'overmind start -l detail,detail-web'

start-ui-demo: build-utils ## start ui_kits demo
	sh -c 'overmind start -l ui-kits-demo'

start-amos: ## start amos-land-page
	sh -c 'overmind start -l amos'

ssh-remote: ## ssh to remote dev host (set DEV_USER and DEV_BOX_IP in .env)
	ssh $${DEV_USER}@$${DEV_BOX_IP}

##@ Build

build-utils: ## build utils
	sh -c 'overmind start -l build-utils'

build-ui-kits: build-utils ## build ui-kits
	overmind start -l build-ui-kits

##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)
