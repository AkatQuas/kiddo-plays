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
cd $(1) && yarn && echo "\n\n" && git status
endef

define fetch_latest
echo "$(BLUE)$(1)$(NOFORMAT)"
cd $(1) && git fetch origin && git remote prune origin
echo ""
endef

define open_web
echo "$(BLUE)open $(1) $(NOFORMAT)"
sh -c '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --profile-directory=Profile\ 1 "$(1)" &> /dev/null & disown'
endef

define link_parasitic
if [ ! -L $(1)/parasitic ]; then ln -s $(CWD)/parasitic $(1)/parasitic; fi
endef

#
# Tweak the variables based on your project.
#
DATA_ROOT=~/workspace/pdata
REDIS := web-redis
REDIS_IMAGE=redis:6-alpine
MONGO := web-mongo
MONGO_IMAGE=mongo:3-xenial

# Current version of the project.

TOOLKIT_DIR=$(CWD)/miniapp-toolkit
VELA_DIR=$(CWD)/vela
# Optional: host IDE extensions directory for link_parasitic
IDE_EXTENSIONS_DIR?=

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
targets =help groupdhelp list-help _check-docker _start-redis _start-mongo _stop-redis _stop-mongo stop-redmon clean-redmon _setup_toolkit _setup_vela gfo yarn_mini yarn_vela kit_watch ide ide_local ide_local_extensions vela vela_client vela_extensions link_parasitic compile_parasitic vela_link_local vela_use_package timeline_link_local timeline_revert set_ide_tob set_ide_online start_app_debug test test_electron_builder clean_electron_builder build_vela_extensions vela_repo mini_repo mini_pipeline code_merge code_list clean clean_ide_output


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

_setup_toolkit: ## set up toolkit project
	$(call ensure_yarn,$(TOOLKIT_DIR))

_setup_vela: ## set up toolkit project
	$(call ensure_yarn,$(VELA_DIR))

gfo: ## git fetch origin
	$(call fetch_latest, $(TOOLKIT_DIR))
	$(call fetch_latest, $(VELA_DIR))
# $(call fetch_latest, $(CWD)/../github-repos/vscode)

##@ Development

yarn_mini: vela_use_package  ## yarn install in miniapp-toolkit
	$(call update_yarn, $(TOOLKIT_DIR))

yarn_vela: ## yarn install in vela
	$(call update_yarn, $(VELA_DIR))

kit_watch: _setup_toolkit vela_use_package ## start all toolkit
	overmind start -l kit_watch

ide: _setup_toolkit clean_ide_output vela_use_package ## start all toolkit
	overmind start -l kit_watch,ide

# make ide_local_vela > ide.log 2>&1
ide_local: _setup_toolkit clean_ide_output _setup_vela vela_link_local ## start all toolkit
	overmind start -l vela_client,kit_watch,ide

ide_local_extensions: _setup_toolkit clean_ide_output _setup_vela vela_link_local ## start all toolkit
	overmind start -l vela_client,vela_extensions,kit_watch,ide

vela: _setup_vela ## start vela
	overmind start -l vela_client,vela_extensions

vela_client: _setup_vela ## start vela
	overmind start -l vela_client

vela_extensions: _setup_vela ## start vela
	overmind start -l vela_extensions

link_parasitic: ## link local extensions into IDE_EXTENSIONS_DIR (set in Makefile)
	@test -n "$(IDE_EXTENSIONS_DIR)" || (echo "Set IDE_EXTENSIONS_DIR in Makefile" && exit 1)
	$(call link_parasitic, $(IDE_EXTENSIONS_DIR))

compile_parasitic: ## complie the parasitic extensions
	cd $(CWD)/parasitic && npx tsc -watch -p ./

timeline_link_local: ## link timeline output to node_modules
	if [ -d "$(TIMELINE_BUNDLE)" ] && [ ! -d "$(TIMELINE_BUNDLE)_bak" ] ; then \
		mv $(TIMELINE_BUNDLE) $(TIMELINE_BUNDLE)_bak; \
		ln -s $(TOOLKIT_DIR)/packages/miniprogram-trace/out $(TIMELINE_BUNDLE); \
	fi
	open $(TIMELINE_BUNDLE)_bak
	echo "$(GREEN)timeline output linked, OK$(NOFORMAT)"

timeline_revert: ## revert timeline output to node_modules
	if [ -L "$(TIMELINE_BUNDLE)" ] && [ -d "$(TIMELINE_BUNDLE)_bak" ] ; then \
		rm $(TIMELINE_BUNDLE) || true; \
		mv $(TIMELINE_BUNDLE)_bak $(TIMELINE_BUNDLE); \
	fi
	open $(TIMELINE_BUNDLE)
	echo "$(GREEN)timeline output linked, OK$(NOFORMAT)"

##@ Build

test: ## test anything
	$(info $(RED)Message$(NOFORMAT))
	$(info $(GREEN)Message$(NOFORMAT))
	$(info $(YELLOW)Message$(NOFORMAT))
	$(info $(BLUE)Message$(NOFORMAT))
	$(info $(MAGENTA)Message$(NOFORMAT))
	$(info $(CYAN)Message$(NOFORMAT))
	$(info $(WHITE)Message$(NOFORMAT))

test_electron_builder: vela_use_package ## electron-builder local
	cd $(TOOLKIT_DIR)/packages/miniprogram-ide && NODE_ENV=production NODE_OPTIONS=--max-old-space-size=4096 npx webpack && DEBUG=electron-builder node build/build-mac.js

clean_electron_builder: ## clean up the test
	for item in dist output packageTemp; do \
		dir=$(TOOLKIT_DIR)/packages/miniprogram-ide/$${item}; \
		(rm -rf $${dir} || true); \
	done
	$(MAKE) yarn_mini

build_vela_extensions: ## build some vela_extensions
	cd $(VELA_DIR) && node build/lib/builtInExtensions.js && npx gulp compile-extensions-build --max_old_space_size=4095

open_web: ## open the tron build page
	$(call open_web, "https://cn.bing.com")

##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)

clean_ide_output: ## Cleanup the distribution in ide folders
	rm -rf $(TOOLKIT_DIR)/packages/miniprogram-ide/dist || true
