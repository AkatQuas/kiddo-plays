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

MONO_DIR=$(CWD)/mono

# $(call file-exists, file-name)
#   Return non-null if a file exists.
file-exists = $(wildcard $1)

define beeps
tput bel
endef

define test_fetch
echo  $(1)
if [ -d $1 ]; then \
	echo "yes"; \
else \
	echo "bad"; \
fi
endef

define test_fetch_2
echo  $(1)_src
$(if $(call file-exists, $1), cd $1 && pwd)
endef

define do_fetch
if [ -d $1 ]; then \
	cd $(1) ;\
	REMOTE_TRACK=$$(git for-each-ref --format='%(upstream:short)' "$$(git symbolic-ref -q HEAD)" | sed -e "s#^origin/##"); \
	if [ -z "$${REMOTE_TRACK}" ]; then \
		echo "Remote track branch not found. Please fetch and rebase manually." && exit 0; \
	fi ;\
	git fetch --prune --no-tags origin $${REMOTE_TRACK} ;\
	git remote prune origin ;\
fi
endef

define do_rebase
if [ -d $1 ]; then \
	cd $(1) ;\
	default_branch=$$(git ls-remote --symref origin main master  | awk '{print $$2}' | awk -F'/' '{print $$3}') ;\
	if [[ $$(git status --porcelain) ]]; then \
	  git stash -u && _STAGED='did' ; \
	fi ;\
	git rebase --reapply-cherry-picks FETCH_HEAD ;\
	if [[ -n "$${_STAGED}" ]] ; then \
		git stash pop ; \
	elif [[ ! $$(git diff origin/$${default_branch} --name-only) ]] ; then \
		git branch -m $${default_branch}; \
	fi \
fi
endef

# $(if $(call file-exists, $1), $(call do_fetch, $(1)) $(call do_rebase, $(1)), $(info $(RED)not exist$(NOFORMAT)))
define fetch_rebase
echo "Fetch and rebase in $(BLUE)$(1)$(NOFORMAT)"
$(call do_fetch, $(1))
$(call do_rebase, $(1))
endef

define git_status
echo "status in $(BLUE)$(1)$(NOFORMAT)"
$(call do_fetch, $(1))
cd $(1) && git status;
read -p 'Rebase: (Y/n)' should_ ;\
	if [[ $${should_} != 'n' ]] ;\
	  then $(call do_rebase, $(1)) ;\
	fi ;\
	echo ""
endef


define git_clean
echo "clean up and gc in $(BLUE)$(1)$(NOFORMAT)"
if [ -d $1 ]; then \
	cd $(1) ;\
	git remote prune origin ;\
	git tag -l | xargs git tag -d ;\
	git gc --auto ;\
fi
echo ""
endef

define nvm_use
source ~/.nvm/nvm.sh ;\
  nvm use $(1)
endef

define open_web
# echo "$(BLUE)open $(1) $(NOFORMAT)"
sh -c '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --profile-directory=Profile\ 1 "$(1)" > /dev/null 2>&1 & disown'
endef

# link $2 to $1
# $1 source to link, $2 target to replace
define link_local
open $(call dir ,$(2))
echo "$(GREEN) $(2) linked to $(1) OK$(NOFORMAT)"
endef

# remove file from zip
#
# zip -d some.zip __MACOSX/\*
# zip -d filename.zip \*/.DS_Store
#

# revert package
# $1 the linked target
define local_package
if [ -d "$(1)_bak" ] && [ -L "$(1)" ] ; then \
  rm $(1) || true; \
  mv $(1)_bak $(1); \
fi
echo "$(GREEN) $(1) use package OK$(NOFORMAT)"
endef
#
# Tweak the variables based on your project.
#

# Current version of the project.


#
# Define all targets. At least the following commands are required:
#

SHELL:=/bin/bash
.DEFAULT_GOAL:=help
TARGETS = gfo git_clean groupdhelp help mono_lint mono_project mono_repo mono_setup proc_list silenthelp test test_for_loop transfer_project wifi_status


# All targets.
.SILENT: $(TARGETS)
.PHONY: $(TARGETS)

help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n\nTargets:\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

groupdhelp:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m\033[0m\n"} /^[a-zA-Z0-9_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

silenthelp: ## silent the targets
	@ sed -i '' -E "s/^TARGETS =.*$$/TARGETS = ""$$(awk -F":.*##" '/^[a-zA-Z0-9_-]+:.*?##/ { printf $$1 " " }' $(MAKEFILE_LIST) | tr " " "\n" | sort -n | tr "\n" " ")""/" $(MAKEFILE_LIST)

##@ Setup

mono_repo: ## print mono repo path
	@echo "$(MONO_DIR)"

mono_setup: ## mono mono repo setup
	cd $(MONO_DIR) && npm_config_engine_strict=false emo install

mono_lint: ## mono repo lint diff files
	cd $(MONO_DIR); \
		./node_modules/.bin/eslint \
			--quiet \
			--fix \
			--no-error-on-unmatched-pattern \
			$$(git diff  $$(git for-each-ref --format='%(upstream:short)' "$$(git symbolic-ref -q HEAD)") --name-only --diff-filter=ACM | egrep '\.(js|jsx|ts|tsx|ttml)$$') ;\
		./node_modules/.bin/stylelint \
			--quiet \
			--fix \
			--allow-empty-input \
			$$(git diff  $$(git for-each-ref --format='%(upstream:short)' "$$(git symbolic-ref -q HEAD)") --name-only --diff-filter=ACM | egrep '\.(css|ttss|less|scss)$$') ;\

lint_diff_files: ## only lint diff files
	cd $(MONO_DIR); \
		./node_modules/.bin/eslint \
			--fix \
			$$(git diff  $$(git for-each-ref --format='%(upstream:short)' "$$(git symbolic-ref -q HEAD)") --name-only --diff-filter=ACM) ;

git_dashboard: ## show mono git status
	cd $(MONO_DIR) && git status -sb

gfo: ## run git fetch origin and rebase in repo
	$(call fetch_rebase, $(MONO_DIR))

##@ Development

# Get the current WiFi network name
# Check if the WiFi network name is empty (i.e. not connected)
wifi_status: ## wifi status
	wifi_network=$$(networksetup -getairportnetwork en0 | grep 'Current Wi-Fi Network:' | awk -F': ' '{print $2}')  ;\
	if [ -z "$$wifi_network" ]; then \
		echo "$(RED)Not connected to WiFi$(NOFORMAT)" ;\
	else \
		echo "$(YELLOW)Connected to WiFi: $$wifi_network $(NOFORMAT)" ;\
	fi
	echo "node version $$(node -v)"
	sleep 1

mono_project: wifi_status proc_list ## run all mono projects, powered by Procfile
	overmind start -l $$(awk  'BEGIN {FS = ":"; ORS = ","}  /^mono_*/ {print $$1}' ./Procfile)


##@ Build

transfer_project: wifi_status ## run all search transfer projects
	overmind start -l $$(awk  'BEGIN {FS = ":"; ORS = ","}  /^transfer_*/ {print $$1}' ./Procfile)

##@ Miscellany

proc_list: ## List process in Procfile
	echo "project list \"$$(awk  'BEGIN {FS = ":"}  /^[^#].*:\s?.*/ {print $$1}' ./Procfile)\"" && sleep 1

git_clean: ## Cleanup the project folders
	$(info Cleaning up things)
	$(call git_clean, $(MONO_DIR))

test_for_loop: ## for loop
	for item in $(MONO_DIR) $(MAINMONO_DIR); do \
	 	cd $${item}; \
		pwd ;\
	done

test: ## test anything
	$(info $(RED)Message$(NOFORMAT))
	$(info $(GREEN)Message$(NOFORMAT))
	$(info $(YELLOW)Message$(NOFORMAT))
	$(info $(BLUE)Message$(NOFORMAT))
	$(info $(MAGENTA)Message$(NOFORMAT))
	$(info $(CYAN)Message$(NOFORMAT))
	$(info $(WHITE)Message$(NOFORMAT))
