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

target_commit=ae8b17c1d1835cfd8c03db30d2c3799a4e2edfe8
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)
package_dir=$(dirname "${script_dir}")
workshop_dir="${package_dir}/workshop"
source_workshop_dir="${package_dir}/src/workshop"

# accessing files are in relative path to current script
# cat "$script_dir/my_file"

usage() {
  cat <<EOF
Usage: $(basename "${BASH_SOURCE[0]}") [-h]

Prepare Devtools Upgrade.

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

fetch_code() {
  mkdir -p "$workshop_dir"
  cd "$workshop_dir"
  if [ -d "$workshop_dir/devtools-frontend" ]
  then
    msg "${ORANGE}devtools-frontend already cloned. Use \"gclient sync\" to update.${NOFORMAT}"
  else
    msg "${ORANGE}devtools-frontend will be cloned into $(pwd)/devtools-frontend${NOFORMAT}"
    fetch devtools-frontend
    msg "${GREEN}devtools-frontend cloned successfully!${NOFORMAT}"
  fi
  return 0
}

build_once() {
  cd "$workshop_dir"
  cd devtools-frontend
  msg "${ORANGE}devtools-frontend use commit${NOFORMAT} ${RED}${target_commit}${NOFORMAT}"
  git status
  git switch -d "$target_commit"
  gclient sync

  gn gen out/Default
  # --args='devtools_skip_typecheck=true'
  autoninja -C out/Default
  return 0
}

copy_to_source() {
  rm -rf "$source_workshop_dir" || true
  mkdir "$source_workshop_dir"
  cp -iR "$workshop_dir/devtools-frontend/out/Default/gen/front_end" "$source_workshop_dir"
  cd "$source_workshop_dir"
  # rm -rf $(find . -type d -name "*test_runner")
  # find . -type f \( -name "*.js.map*" -o -name "*.mjs.map*" -o -name "*.d.ts" -o -name "*.json.tsbuildinfo" -o -name "*-tsconfig.json" -o -name "*_test_runner*" \) -delete
  return 0
}

create_diff() {
  cd "$source_workshop_dir"
  git init && git add front_end && git commit -m 'init'
  rm -rf front_end && cp -iR "$package_dir/src/devtools/front_end" ./ && git add . && git diff -w HEAD > "$package_dir/changelog.diff" && git restore --staged ./
  rm -rf .git
}

parse_params "$@"
setup_colors

# optional message display

# script logic here

if command -v gclient > /dev/null
then
  msg "${GREEN}Great, you already have depot_tools installed!${NOFORMAT}"
else
  die "ERROR: gclient not installed, please install depot_tools. https://commondatastorage.googleapis.com/chrome-infra-docs/flat/depot_tools/docs/html/depot_tools_tutorial.html"
fi

# fetch_code

# build_once

copy_to_source

create_diff

msg "${ORANGE}You can patch devtools-frontend now.${NOFORMAT}"
msg "Directory :  ${GREEN}$source_workshop_dir/front_end${NOFORMAT}"
msg "Patch file:  ${GREEN}$package_dir/changelog.diff${NOFORMAT}"
