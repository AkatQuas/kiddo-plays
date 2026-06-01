#!/usr/bin/env bash

# fast error fail
set -Eeuo pipefail
trap cleanup SIGINT SIGTERM ERR EXIT

# Reset IFS. Even though IFS may not be imported from the environment,
# $ENV could set it. This uses special bash and ksh93 notation, not in POSIX.
IFS=$' \t\n'

# Make sure unalias is not a function, since it's a regular built-in.
# unset is a special built-in, so it will be found before functions.
unset -f unalias

# Unset all alias and quote unalias so it's not alias-expanded.
unalias -a

# Make sure command is no a function, since it's a regular built-in.
# unset is a special built-in, so it will be found before functions.
unset -f command

# Get a reliable path prefix, handling case where getconf is not available.
SYSPATH="$(command -p getconf PATH 2>/dev/null)"
if [[ -z "$SYSPATH" ]]; then
  SYSPATH="/usr/bin:/bin" # pick your poison
fi
PATH="$SYSPATH:$PATH"

target_commit=07239a7501c32f68358495816b6eb87f7f600eff
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)
package_dir=$(dirname "${script_dir}")
workshop_dir="${package_dir}/workshop"
target_project="jsoneditor"

# accessing files are in relative path to current script
# cat "$script_dir/my_file"

usage() {
  cat <<EOF
Usage: $(basename "${BASH_SOURCE[0]}") [-h]

Prepare JSON editor workshop. More at https://github.com/josdejong/jsoneditor .

Available options:

-h, --help      Print this help and exit
EOF
  exit
}

cleanup() {
  trap - SIGINT SIGTERM ERR EXIT
  # script cleanup here
  # close file
  # remove temporary file
}

setup_colors() {
  if [[ -t 2 ]] && [[ -z "${NO_COLOR-}" ]] && [[ "${TERM-}" != "dumb" ]]; then
    NOFORMAT='\033[0m' RED='\033[0;31m' GREEN='\033[0;32m' ORANGE='\033[0;33m' BLUE='\033[0;34m' PURPLE='\033[0;35m' CYAN='\033[0;36m' YELLOW='\033[1;33m'
  else
    NOFORMAT='' RED='' GREEN='' ORANGE='' BLUE='' PURPLE='' CYAN='' YELLOW=''
  fi
}

msg() {
  echo >&2 -e "${1-}"
}

die() {
  local msg=$1
  local code=${2-1} # default exit status 1
  msg "${RED}$msg${NOFORMAT}"
  exit "$code"
}

parse_params() {
  # default values of variables set from params

  while :; do
    case "${1-}" in
    -h | --help) usage ;;
    -v | --verbose) set -x ;;
    --no-color) NO_COLOR=1 ;;
    -?*) die "Unknown option: $1" ;;
    *) break ;;
    esac
    shift
  done

  # check required params and arguments

  return 0
}

ensure_source() {
  if [ ! -d "$1" ]
  then
    msg "${RED}Run fetch_code first to get source!${NOFORMAT}"
    return 1
  fi
  return 0
}

fetch_code() {
  mkdir -p "$workshop_dir"
  cd "$workshop_dir"
  local target="$workshop_dir/$target_project"
  if [ -d "$target" ]
  then
    msg "${ORANGE}$target_project already cloned. You can use \"git fetch\" to update.${NOFORMAT}"
  else
    msg "${ORANGE}$target_project will be cloned into $target${NOFORMAT}"
    git clone git@github.com:josdejong/jsoneditor.git
    cd "$target"
    git switch -d "$target_commit"
    msg "${GREEN}$target cloned successfully!${NOFORMAT}"
  fi
  return 0
}

do_install() {
  local current_hash
  local target="$workshop_dir/$target_project"

  ensure_source "$target"
  cd "$target"
   if [ -z "$(git status --porcelain)" ]; then
    # Working directory clean
    current_hash="$(git rev-parse --verify HEAD)"
    if [ "$current_hash" != "$target_commit" ]; then
      git switch -d "$target_commit"
    fi

    npm install
    git restore ./package-lock.json
  else
    # Uncommitted changes
    msg "${RED}git not clean, please install node_modules manually${NOFORMAT}"
  fi
  return 0
}

apply_patch() {
  local patch_file="$package_dir/jsoneditor.diff"
  local target="$workshop_dir/$target_project"

  ensure_source "$target"

  cd "$target"
  if [ -z "$(git status --porcelain)" ]; then
    git apply "$patch_file"
  else
    msg "${RED}git not clean, please patch manually using $patch_file .${NOFORMAT}"
  fi
}

parse_params "$@"
setup_colors

# optional message display

# script logic here

if command -v git > /dev/null
then
  msg "${GREEN}Great, you already have git installed!${NOFORMAT}"
else
  die "ERROR: git not installed"
fi

fetch_code

do_install

apply_patch

msg "Tip: Please run \n\tgit diff -- \":(exclude)package-lock.json\"  > /path/to/jsoneditor.diff \nto create a new patch after any new changes"
