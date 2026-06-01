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

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)

# accessing files are in relative path to current script
# cat "$script_dir/my_file"

usage() {
  cat <<EOF
Usage: $(basename "${BASH_SOURCE[0]}") [-h] [-v] snippet_hash project_name

Script description here.

Available options:

-h, --help      Print this help and exit
-v, --verbose   Print script debug info
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
  msg "$msg"
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

  args=("$@")

  # check required params and arguments
  # [[ -z "${param-}" ]] && die "Missing required parameter: param"
  [[ ${#args[@]} -eq 0 ]] && die "Missing script arguments"

  return 0
}


download_zip() {
  local url="https://t.cdn.com/$1"
  echo "$url"
  curl -L "$url" --output "/tmp/$1.zip"
  return 0
}

unzip_to() {
  local exampleDir="${HOME}/workspace/examples"
  unzip "/tmp/$1.zip" -d "$exampleDir/$2"
  return 0
}

parse_params "$@"
setup_colors

# optional message display
msg "${RED}Read parameters:${NOFORMAT}"
msg "- arguments: ${args[*]-}"
msg "- ${YELLOW}project hash: ${args[0]} ${NOFORMAT}"
msg "- ${YELLOW}project name: ${args[1]} ${NOFORMAT}"

# script logic here
download_zip  "${args[0]}"
unzip_to "${args[0]}" "${args[1]}"

# test scripts :D
# ./download-code-snippets.sh 2LkyUge  bad-test
