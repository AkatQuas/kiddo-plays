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
cd $(1) && yarn && echo "" && git status
endef

define fetch_latest
echo "$(BLUE)$(1)$(NOFORMAT)"
cd $(1) && git fetch origin && git remote prune origin
echo ""
endef

define open_web
# echo "$(BLUE)open $(1) $(NOFORMAT)"
sh -c '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --profile-directory=Profile\ 1 "$(1)" &> /dev/null & disown'
endef

# link $2 to $1
# $1 source to link, $2 target to replace
define link_local
open $(call dir ,$(2))
echo "$(GREEN) $(2) linked to $(1) OK$(NOFORMAT)"
endef

# revert package
# $1 the linked target
define local_package
if [ -d "$(1)_bak" ] && [ -L "$(1)" ] ; then \
  rm $(1) || true; 	mv $(1)_bak $(1); \
fi
echo "$(GREEN) $(1) use package OK$(NOFORMAT)"
endef
#
# Tweak the variables based on your project.
#

# Current version of the project.

TOOLKIT_DIR=$(CWD)/miniapp-toolkit
# so we can reach to the tila folder
IDE_NODE_TILA_PARENT=$(CWD)/miniapp-toolkit/packages/miniprogram-ide/node_modules/@akat-tila
TILA_DIR=$(CWD)/tila
TILA_BUILD_STUB=$(TILA_DIR)/packages/tila-core/dist/stub
TILA_PKGS=core vscode toolbar utils devtools simulator devtools-service window components
PCSDK_PKG=$(CWD)/miniapp-toolkit/packages/miniprogram-ide/node_modules/@akat/pc-sdk-node
PCSDK_NODE=$(CWD)/pc-sdk/packages/pc-sdk-node

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
targets = help groupdhelp list-help _setup_toolkit _setup_tila _tila_build _tila_watch gfo _hack_bootstrap mini_sync_tsbm yarn_mini yarn_tila apply_mini_dev apply_mini_dev_r kit_watch ide ide_gamed ide_local_pcsdk ide_package ide_tila ide_tila_watch_only tila_link_local tila_use_package pcsdk_link_local pcsdk_use_package pcsdk_rebuild test test_electron_builder goofy clean_electron_builder start_app_debug start_app_debug_327 tila_repo mini_repo mini_pipeline cmerge clist build_treemap oncall_know oncall clean clean_ide_output tila_rebuild

# All targets.
.SILENT: $(targets)
.PHONY: $(targets)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

list-help: ## List all commands
	awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | pbcopy

##@ Setup

_setup_toolkit: ## set up toolkit project
	$(call ensure_yarn,$(TOOLKIT_DIR))

_setup_tila: ## set up toolkit project
	$(call ensure_yarn,$(TILA_DIR))

_tila_build: ## build in tila
	if [ -f $(TILA_BUILD_STUB) ]; then \
		echo ""; echo "$(GREEN)Skip tila building!$(NOFORMAT)"; echo ""; \
	else \
		cd $(TILA_DIR) && NODE_ENV=production CUSTOM_CI_MR_ID=1 npx webpack --progress && echo "42" > $(TILA_BUILD_STUB); \
	fi \

_tila_watch: ## watch in tila
	cd $(TILA_DIR)

gfo: ## git fetch origin
	$(call fetch_latest, $(TOOLKIT_DIR))
	$(call fetch_latest, $(TILA_DIR))
# $(call fetch_latest, $(CWD)/pc-sdk)

_hack_bootstrap: ## use my bootstrap file
	cp $(TOOLKIT_DIR)/.dev_local/bootstrap.js $(TOOLKIT_DIR)/scripts/bootstrap.js

##@ Development

mini_sync_tsbm: ## sync tila_submodule in mini_app
	cd $(TOOLKIT_DIR) && git submodule sync && git submodule update --init && git status

yarn_mini: _hack_bootstrap tila_use_package pcsdk_use_package  ## yarn install in miniapp-toolkit
	$(call update_yarn, $(TOOLKIT_DIR))
	clear && cd $(TOOLKIT_DIR) && git restore ./scripts/bootstrap.js
	$(MAKE) mini_sync_tsbm
	cd $(TOOLKIT_DIR) && pwd && git status
	$(MAKE) tila_link_local

yarn_tila: ## yarn install in tila
	$(call update_yarn, $(TILA_DIR))

apply_mini_dev: ## apply dev.diff in miniapp-toolkit when branch is clean
	cd $(TOOLKIT_DIR) && git diff-index --quiet HEAD && git apply ./.dev_local/dev.diff ; git status

apply_mini_dev_r: ## revert dev.diff in miniapp-toolkit
	cd $(TOOLKIT_DIR) && git apply -R ./.dev_local/dev.diff; git status

kit_watch: _setup_toolkit tila_link_local ## start toolkit only in watch mode
	overmind start -l kit_watch

ide: _setup_toolkit clean_ide_output _setup_tila tila_link_local pcsdk_use_package ## start toolkit in watch and ide running with local tila production(cached)
	$(MAKE) _tila_build
	overmind start -l kit_watch,ide

ide_gamed: _setup_toolkit clean_ide_output _setup_tila tila_link_local pcsdk_use_package ## start toolkit in watch and ide running with local tila production(cached)
	$(MAKE) _tila_build
	overmind start -l game_watch,ide

ide_local_pcsdk: _setup_toolkit clean_ide_output _setup_tila tila_link_local pcsdk_link_local ## start toolkit in watch and ide running with local tila production(cached)
	$(MAKE) _tila_build
	overmind start -l kit_watch,ide

ide_package: _setup_toolkit clean_ide_output tila_use_package ## start toolkit in watch mode and ide running with tila as packages
	overmind start -l kit_watch,ide

ide_tila: _setup_toolkit clean_ide_output _setup_tila tila_link_local ## start toolkit in watch mode and ide running with local tila watch
	overmind start -l tila_watch,kit_watch,ide

ide_tila_watch_only: _setup_toolkit _setup_tila tila_link_local ## start all toolkit in watch with tila watch without ide
	overmind start -l tila_watch,kit_watch

tila_link_local: ## ide link to local tila
	mkdir -p $(IDE_NODE_TILA_PARENT); \
	for f in $(TILA_PKGS); do \
		sPackage=$(TILA_DIR)/packages/tila-$${f}; \
		tPackage=$(IDE_NODE_TILA_PARENT)/$${f}; \
		mkdir -p $${tPackage}; \
  	if [ -d $${tPackage} ] && [ ! -d $${tPackage}_bak ]; then \
			mv $${tPackage} $${tPackage}_bak; \
			ln -s $${sPackage} $${tPackage}; \
		fi; \
	done; \
	open $(IDE_NODE_TILA_PARENT)

tila_use_package: ## ide use packaged tila
	mkdir -p $(IDE_NODE_TILA_PARENT); \
	for f in $(TILA_PKGS); do \
		tPackage=$(IDE_NODE_TILA_PARENT)/$${f}; \
  	if [ -d $${tPackage}_bak ] && [ -L $${tPackage} ]; then \
			rm $${tPackage} || true; \
			mv $${tPackage}_bak $${tPackage}; \
		fi; \
	done; \
	open $(IDE_NODE_TILA_PARENT)

pcsdk_link_local: ## ide usel local pcsdk
	open $(dir $(PCSDK_PKG))
	if [ -d "$(PCSDK_PKG)" ] && [ ! -d "$(PCSDK_PKG)_bak" ] ; then \
		mv $(PCSDK_PKG) $(PCSDK_PKG)_bak; \
		ln -s $(PCSDK_NODE) $(PCSDK_PKG); \
	fi
	echo "$(GREEN)pcsdk dependency linked, OK$(NOFORMAT)"

pcsdk_use_package: ## ide use packaged pcsdk
	open $(dir $(PCSDK_PKG))
	if [ -d "$(PCSDK_PKG)_bak" ] && [ -L "$(PCSDK_PKG)" ]; then \
		rm $(PCSDK_PKG) || true; \
		mv $(PCSDK_PKG)_bak $(PCSDK_PKG); \
	fi
	echo "$(GREEN)pcsdk dependency use package, OK$(NOFORMAT)"

pcsdk_rebuild: ## rebuild local pcsdk
	cd $(CWD)/pc-sdk && npx lerna run build --scope=@akat/pc-sdk-core && npx lerna run build --scope=@akat/pc-sdk-node

##@ Build

test: ## test anything
	$(info $(RED)Message$(NOFORMAT))
	$(info $(GREEN)Message$(NOFORMAT))
	$(info $(YELLOW)Message$(NOFORMAT))
	$(info $(BLUE)Message$(NOFORMAT))
	$(info $(MAGENTA)Message$(NOFORMAT))
	$(info $(CYAN)Message$(NOFORMAT))
	$(info $(WHITE)Message$(NOFORMAT))

test_electron_builder: tila_use_package ## electron-builder local
	cd $(TOOLKIT_DIR)/packages/miniprogram-ide && NODE_ENV=production NODE_OPTIONS=--max-old-space-size=4096 npx webpack && DEBUG=electron-builder node build/build-mac.js

clean_electron_builder: ## clean up the test
	for item in dist output packageTemp; do \
		dir=$(TOOLKIT_DIR)/packages/miniprogram-ide/$${item}; \
		(rm -rf $${dir} || true); \
	done
	$(MAKE) yarn_mini

start_app_debug: ## start the built app as debug
	IDE_PORT=9222 "/Applications/微信开发者工具.app/Contents/MacOS/微信开发者工具"

start_app_debug_327: ## start the built app as debug
	IDE_PORT=9327 "/Applications/微信开发者工具327.app/Contents/MacOS/微信开发者工具"


build_treemap: ## build the treemap and move it to the assets directory in IDE
	cd webtreemap && make build && mv ./dist/index.js $(TOOLKIT_DIR)/packages/miniprogram-ide/src/assets/ext/laboratory/media/project-analyze/treemap.js

##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)

clean_ide_output: ## Cleanup the distribution in ide folders
	rm -rf $(TOOLKIT_DIR)/packages/miniprogram-ide/dist/applications || true

tila_rebuild: ## clean build in tila
	rm $(TILA_BUILD_STUB) || true
	$(MAKE) _tila_build
