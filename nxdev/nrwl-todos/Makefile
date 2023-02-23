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
DATA_ROOT=/data
REDIS := web-redis
REDIS_IMAGE=redis:6-alpine
MONGO := web-mongo
MONGO_IMAGE=mongo:3-xenial

# Current version of the project.

VERSION_BY_DATE = $(shell date +v"%Y%m%d")
USER_ID=$(shell id -u)
CURRENT_DIR = $(shell pwd)

#
# These variables should not need tweaking.
#

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = check-docker clean clean-redmon groupdhelp help silenthelp start-admin start-admin-e2e start-mongo start-redis start-redmon start-tenant start-tenant-e2e stop-mongo stop-redis stop-redmon 


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

check-docker: ## wait docker up-running
	echo "waiting for docker..." && until docker system info > /dev/null 2>&1; do sleep 3; done

start-redis: check-docker ## start redis in docker
	if docker container ps -a | grep $(REDIS) &> /dev/null; then \
		sh -c "docker container start $(REDIS)"; \
	else \
		sh -c "docker run -d --name $(REDIS) -p 6379:6379 -v $(DATA_ROOT)/redis:/data $(REDIS_IMAGE)"; \
	fi

start-mongo: check-docker ## start mongo in docker
	if docker container ps -a | grep $(MONGO) &> /dev/null; then \
		sh -c "docker container start $(MONGO)"; \
	else \
		sh -c "docker run -d --name $(MONGO) -p 27017:27017 -v $(DATA_ROOT)/mongo:/data/db $(MONGO_IMAGE)"; \
	fi

start-redmon: start-redis start-mongo ## start redis and mongo
	echo "mongo and redis started"

stop-redis: ## stop redis
	sh -c 'docker container stop $(REDIS)'

stop-mongo: ## stop mongo
	sh -c 'docker container stop $(MONGO)'

stop-redmon: stop-redis stop-mongo ## stop redis and mongo
	echo "mongo stoped, redis stoped"

clean-redmon: stop-redmon ## remove redis and mongo containers
	sh -c 'docker container rm $(REDIS) && docker container rm $(MONGO)'

##@ Development

start-admin: ## start admin project
	overmind start -l 'admin,admin-api'

start-admin-e2e: ## start admin e2e project
	overmind start -l 'admin-e2e,admin-api'

start-tenant: ## start tenant project
	overmind start -l 'tenant-gql,tenant-api,tenant'

start-tenant-e2e: ## start tenant-e2e project
	overmind start -l 'tenant-gql,tenant-api,tenant-e2e'

##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)
