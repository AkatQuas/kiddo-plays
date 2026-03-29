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

define fetch_rebase
echo "$(BLUE)$(1)$(NOFORMAT)"
cd $(1) && git fetch origin ; git remote prune origin ; git stash push -u ; git rebase $$(git for-each-ref --format='%(upstream:short)' "$$(git symbolic-ref -q HEAD)") ; if $$(git stash show 0 &> /dev/null) ; then pwd && git stash pop ; fi
echo ""
endef

define nvm_use
source ~/.nvm/nvm.sh && nvm use $(1)
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
if [ -d "$(1)_bak" ] && [ -L "$(1)" ] ; then
  rm $(1) || true;
	mv $(1)_bak $(1);
fi
echo "$(GREEN) $(1) use package OK$(NOFORMAT)"
endef
#
# Tweak the variables based on your project.
#

# Current version of the project.

# so we can reach to the tila folder

#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
targets = anywhere clean dyhuodong gfo groupdhelp help list-help lynx_main_v2 lynxmain_repo mainmono_repo mainmono_setup tea_board test test_gfo


# All targets.
.SILENT: $(targets)
.PHONY: $(targets)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

list-help: ## List all commands
	awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | tr " " "\n" | sort -n | tr "\n" " " | pbcopy

##@ Setup

build-steganography: ## build the dependency
	./scripts/build-steganography.sh

##@ Development

##@ Build

encode:
	./steganography encode --input big-size-crunch.png --embed hz-life.zip --passwd 1234 --output output-crunch.png

test: ## test anything
	$(info $(RED)Message$(NOFORMAT))
	$(info $(GREEN)Message$(NOFORMAT))
	$(info $(YELLOW)Message$(NOFORMAT))
	$(info $(BLUE)Message$(NOFORMAT))
	$(info $(MAGENTA)Message$(NOFORMAT))
	$(info $(CYAN)Message$(NOFORMAT))
	$(info $(WHITE)Message$(NOFORMAT))



##@ Cleanup

clean: ## Cleanup the project folders
	$(info Cleaning up things)
