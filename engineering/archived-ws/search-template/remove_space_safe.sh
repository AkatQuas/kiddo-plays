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

: "${TERM_PROGRAM:='default_term'}"

WORKSPACE="${WORKSPACE_ROOT:-${HOME}/workspace}"
TEMPLATE="${WORKSPACE}/search-template"
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd -P)


# accessing files are in relative path to current script
# cat "$script_dir/my_file"

usage() {
  cat <<EOF
Usage: $(basename "${BASH_SOURCE[0]}") [-h] [-v] story

Remove the <story> workspace safely.

Available options:

-h, --help         Print this help and exit
-v, --verbose      Output with verbose.
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
  while :; do
    case "${1-}" in
    -h | --help) usage ;;
    -v | --verbose) set -x ;;
    -?*) die "Unknown option: $1" ;;
    *) break ;;
    esac
    shift
  done

  args=("$@")

  # check required params and arguments
  [[ ${#args[@]} -ne 1 ]] && die "Need and only need one arguments, which will be prefixed with 'search-'"

  return 0
}

normalize_target() {
  target=''
  if [[ "$1" =~ ^search-* ]]; then
    target=$1
  else
    target="search-$1"
  fi
  project_folder="$WORKSPACE/$target"

  if [ ! -d "$project_folder" ]; then
    die "$target does not exist"
  fi

  msg "Try to REMOVE ${RED}$project_folder${NOFORMAT}"
}


do_clone() {
  cd "$project_folder"
  repos=(
    # set MONO_REPO_URL if you need remote checks
  )

  for repo in "${repos[@]}"; do
    git clone --depth=1 "$repo" > /dev/null
  done
}

tailoring() {
  sed "s/search-template/$target/g" < "$1" > "$2"
}

reverse_tailoring() {
  sed "s/$target/search-template/g" < "$1" > "$2"
}

# do_patch() {
#   cp "$TEMPLATE/Makefile" "$project_folder/Makefile"
#   tailoring "$TEMPLATE/.env" "$project_folder/.env"
#   cp "$TEMPLATE/Procfile" "$project_folder/Procfile"
#   tailoring "$TEMPLATE/search-template.code-workspace" "$project_folder/$target.code-workspace"
# }


better_in_vscode(){
  if [[ "$TERM_PROGRAM" != "vscode" ]]; then
    msg "\n${CYAN} Better run this script in vscode terminal${NOFORMAT}\n"
    sleep 3
  fi
}

#
# ensure git clean in one repo
#
#
ensure_repo_clean() {
  local repo="$1"
  if [ ! -d "$repo" ]; then
    msg "${YELLOW}Skip${NOFORMAT}: $repo does not exist"
    return 0;
  fi
  if [ ! -d "$repo/.git" ]; then
    msg "${YELLOW}Skip${NOFORMAT}: $repo is not a git repository"
    return 0
  fi


  # msg "ensure repo clean in $repo"
  cd "$repo"

  local output
  output="$(git status --porcelain)"

  # ensure stage clean
  if [ -n "$output" ]; then
    # Uncommitted changes
    msg "${RED}$repo has uncommitted changes${NOFORMAT}"
    git status
    msg "\n\n"
    return 0
  fi

  # ensure branch clean
  local based_point
  local current_branch
  based_point="$(git for-each-ref --format='%(upstream:short)' "$(git symbolic-ref -q HEAD)")"

  if [ -z "$based_point" ]; then
    msg "${RED}$repo has unknown base branch${NOFORMAT}"
    msg "Check it by yourself"
    msg "\n\n"
    return 0
  fi
  current_branch="$(git rev-parse --abbrev-ref HEAD)"

  # msg "based on $based_point"
  # output="$(git diff "$based_point"..."$current_branch" --name-status)"
  # if [ -n "$output" ]; then
  #   msg "${RED}$repo has un-merged changes${NOFORMAT}"
  #   msg "$output\n\n"
  #   return 0
  # fi

  if ! git merge-base --is-ancestor "$current_branch" "$based_point" >/dev/null ; then
    msg "${RED}$repo has unmerged commits${NOFORMAT}"
    msg "\n\n"
    return 0
  fi

  msg "${GREEN}$repo${NOFORMAT} is safe to remove"

}

ensure_git_clean() {
  local repos=(
    mono
    main_mono
  )

  for repo in "${repos[@]}"; do
    ensure_repo_clean "$project_folder/$repo"
    echo ""
  done
}

# compare_file <source> <target>
compare_file() {
  # msg "do some compare between $1 $2"
  if [[ $(diff "$1" "$2") ]]; then
    msg "${RED}Differences between\n\t$1\n\t$2${NOFORMAT}"
    echo ""
    msg "code -d $1 $2"
    msg "\n\n"
  else
    msg "rm $2"
  fi
}

ensure_conf_clean() {
  local files=(
    Makefile
    Procfile
  )

  for file in "${files[@]}" ; do
    local template_file="$TEMPLATE/$file"
    local project_file="$project_folder/$file"
    compare_file "$project_file" "$template_file"
  done

  # tailored
  reverse_tailoring "$project_folder/.env" "$project_folder/.env.tailor"
  reverse_tailoring "$project_folder/$target.code-workspace" "$project_folder/$target.code-workspace.tailor"

  compare_file "$project_folder/.env.tailor" "$TEMPLATE/.env"
  compare_file "$project_folder/$target.code-workspace.tailor" "$TEMPLATE/search-template.code-workspace"
}

parse_params "$@"
setup_colors

# msg "${RED}Flags:${NOFORMAT}"

better_in_vscode

normalize_target "${args[0]}"

ensure_git_clean

ensure_conf_clean
