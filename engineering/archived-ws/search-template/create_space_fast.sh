#! /usr/bin/env bash

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

WORKSPACE="${WORKSPACE_ROOT:-${HOME}/workspace}"
TEMPLATE="${WORKSPACE}/search-template"
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)


# accessing files are in relative path to current script
# cat "$script_dir/my_file"

usage() {
  cat <<EOF
Usage: $(basename "${BASH_SOURCE[0]}") [-i] [-o] [-h] [-v] [--switch-branch <branch>] story

Create a workspace for story.

Clone the mono project quickly with \`depth=1\`.

Available options:

-h, --help         Print this help and exit
-i, --install      Install dependencies after clone. [\`false\`]
-o, --open         Open the project in vscode. [\`false\`]
-v, --verbose      Output with verbose.
--switch-branch    Switch to branch after clone. Give a string if necessary. [\`''\']
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
  local exit_code=${2-1} # default exit status 1
  msg "$msg"
  exit "$exit_code"
}

parse_params() {
  install_flag=0
  open_flag=0
  switch_branch_option=''
  while :; do
    case "${1-}" in
    -h | --help) usage ;;
    --switch-branch)
      switch_branch_option="${2-}"
      shift
      ;;
    -i | --install) install_flag=1 ;;
    -o | --open) open_flag=1 ;;
    -v | --verbose) set -x ;;
    -?*) die "Unknown option: $1" ;;
    *) break ;;
    esac
    shift
  done

  args=("$@")

  # check required params and arguments
  [[ ${#args[@]} -ne 1 ]] && die "Need and only need one arguments"

  return 0
}

normalize_target() {
  target=''
  if [[ "$1" =~ ^search-* ]]; then
    target=$1
  else
    target="search-$1"
  fi
  target_folder="$WORKSPACE/$target"

  if [ -d "$target_folder" ]; then
    die "$target already exist"
  fi

  mkdir -p "$target_folder"
  msg "${ORANGE}Working in $target_folder${NOFORMAT}"
}


do_clone() {
  cd "$target_folder"
  # Set MONO_REPO_URL before running, e.g. git@github.com:org/mono.git
  local repos=(
    "${MONO_REPO_URL:-git@github.com:YOUR_ORG/mono.git}"
  )

  for repo in "${repos[@]}"; do
    git clone --single-branch --branch master --shallow-since=8.weeks "$repo" > /dev/null
  done
}

tailoring() {
  sed "s/search-template/$target/g" < "$1" > "$2"
}

do_patch() {
  cp "$TEMPLATE/Makefile" "$target_folder/Makefile"
  tailoring "$TEMPLATE/.env" "$target_folder/.env"
  cp "$TEMPLATE/Procfile" "$target_folder/Procfile"
  tailoring "$TEMPLATE/search-template.code-workspace" "$target_folder/$target.code-workspace"
}

try_setup() {
  if [[ "$install_flag" != 1 ]]; then
    return 0
  fi

  cd "$target_folder"
  if [[ -d mono ]]; then
    make mono_setup
  else
    msg "skip installation in mono"
  fi

  if [[ -d main_mono ]] ; then
    make main_mono_setup
  else
    msg "skip installation in main_mono"
  fi
}

try_open() {
  if [[ "$open_flag" != 1 ]]; then
    return 0
  fi

  if command -v code > /dev/null 2>&1 ; then
    code "$target_folder/$target.code-workspace"
  fi
}

try_switch_branch() {
  if [[ -z "$switch_branch_option" ]]; then
    return 0
  fi

  for repo in "$target_folder/main_mono" "$target_folder/mono" ; do
    if [ -d "$repo" ]; then
      cd "$repo"
      git switch --create "$switch_branch_option" origin/master > /dev/null
    fi
  done
}

parse_params "$@"
setup_colors

msg "${RED}Flags:${NOFORMAT}"
msg "- install:         $install_flag"
msg "- open:            $open_flag"
msg "- switch branch:   $switch_branch_option"

normalize_target "${args[0]}"

do_clone

do_patch

try_switch_branch

try_setup

try_open

msg "${GREEN}You can play now.${NOFORMAT}"
msg "  $target_folder"
msg ""

msg "${CYAN}More mono projects are here.${NOFORMAT}"
find $WORKSPACE -maxdepth 1 -type d -iname '*search-*' | sed -e 's/^/  /'
msg ""
