# Copyright 2020 AkatQuas
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
REDIS := local_redis
MONGO := local_mongo

# Current version of the project.

# project version
VERSION = 0.0.1
# using git tags
VERSION_IN_GIT = $(shell git describe --tags --always --dirty)

#
# These variables should not need tweaking.
#

AUTHOR = AkatQuas
EMAIL = example@bt.com

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help

# All targets.
.PHONY:

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Utils

start-redis: ## start redis in docker
	@sh -c 'docker run -d --name $(REDIS) -p 6379:6379 -v /data/redis:/data redis:latest'

start-mongo: ## start mongo in docker
	@sh -c 'docker run -d --name $(MONGO) -p 27017:27017 -v /data/mongo:/data/db mongo:latest'

start-redmon: start-redis start-mongo ## start redis and mongo
	@echo "mongo and redis started"

stop-redis: ## stop redis
	@sh -c 'docker container stop $(REDIS)'

stop-mongo: ## stop mongo
	@sh -c 'docker container stop $(MONGO)'

stop-redmon: stop-redis stop-mongo ## stop redis and mongo
	@echo "mongo stoped, redis stoped"

clean-redmon: stop-redmon ## remove redis and mongo containers
	@sh -c 'docker container rm $(REDIS)' && \
	sh -c 'docker container rm $(MONGO)'

##@ Development

develop:  ## using Procfile to start development
	@sh -c 'yarn start'

build:
	@sh -c './build.sh'

##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)
