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
COMMIT_SHA=$(shell git rev-parse --short HEAD)
COMMIT_REF_NAME=$(shell git branch --show-current)
COMMIT_REF_NAME=$(shell git rev-parse --abbrev-ref HEAD)

#
# These variables should not need tweaking.
#
VERSION_BY_DATE = $(shell date +v"%Y%m%d")
USER_ID=$(shell id -u)
CURRENT_DIR = $(shell pwd)

WORK_WEB_DIR=workflow-web
WORK_CARGO_REGISTRY=test.cargo.io

ONEC_WEB_DIR=oneconnect-web
#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
targets = help groupdhelp list-help _start-redis _start-mongo _stop-redis _stop-mongo stop-redmon clean-redmon _check-docker start-onec start-work ssh-cargo-onec ssh-cargo-work login-cargo-work build-container-work build-container-onec clean


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
		sh -c "docker run -d  -e REDIS_PASSWORD=Pwd123456 --name $(REDIS) -p 6379:6379 -v $(DATA_ROOT)/redis:/data $(REDIS_IMAGE)"; \
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

start-onec:  _start-redis ## start oneconect-web
	sh -c 'overmind start -l os,of'

start-work: _start-redis ## start workflow-web
	sh -c 'overmind start -l ws,wf'

ssh-cargo-onec: ## ssh to cargo for onec, ssh to master: ssh root@10.0.0.4
	echo "Caicloud&2020" | pbcopy && ssh root@120.221.92.31

# 新环境通过跳板机访问:    150.138.186.162   root / Compass.2021
ssh-cargo-work: # ssh to cargo,
#         				ssh to master:  ssh root@192.168.0.229
#									ssh to habor:  ssh root@192.168.0.119
	echo "Compass.2021" | pbcopy && ssh root@150.138.186.162

login-cargo-work: ## login to cargo
	echo "admin @ Pwd123456" && docker login $(WORK_CARGO_REGISTRY)

##@ Build

build-container-work: _check-docker ## build container in workflow-web
	cd $(WORK_WEB_DIR) && VERSION=$(VERSION_BY_DATE) REGISTRY=$(WORK_CARGO_REGISTRY)/release BUILD_ENV=prod make container

build-container-onec: _check-docker ## build container in oneconnect-web
	cd $(ONEC_WEB_DIR) && VERSION=$(VERSION_BY_DATE) BUILD_ENV=prod make container

##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)
	echo "$(COMMIT_REF_NAME)"
