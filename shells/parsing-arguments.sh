#! /usr/bin/env bash

# Exit script when erros occurrs
set -e

# Exit script when undefined variables occurr
set -u

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

file=
verbose=
quiet=
long=

while getopts :f:vql opt
do
  printf "get options \e[31m%s\e[0m\n" "$opt"
  case $opt in
  f) file=$OPTARG
    ;;
  v) verbose=true
      quiet=
  ;;
  q) quiet=true
    verbose=
  ;;
  l) long=true
  ;;
  '?') printf "%s: invalid option -%s\n" "$0" "$OPTARG" >&2
    printf "Usage: %s [-f file] [-vql] [files ...]\n" "$0" >&2
    exit 1
    ;;
  *) printf "Unknow option %s\n" "$opt"
      exit 1
  ;;
  esac
done

# Remove options, using arguments
# uncomment this if necessary
# shift $((OPTIND - 1))

printf "using \e[32mgetopts\e[0m to parse arguments:\n\t\e[33mfile %s, verbose %s, quiet %s, long %s\n\e[0m" "$file" "$verbose" "$quiet" "$long"

# if not using `getopts`
# we can iterate over the arguments manually
while [ $# -gt 0 ]
do
  printf "having arg \e[31m%s\e[0m\n" "$1"
  case $1 in
  -f | --file)
    # remove flag
    shift
    # assing value to variable
    file="$1"
  ;;
  -v | --verbose)
    verbose=true
    quiet=
  ;;
  -q | --quiet)
    quiet=true
    verbose=
  ;;
  -l | --long)
    long=true
  ;;
  '?') printf "%s: invalid option -%s\n" "$0" "$OPTARG" >&2
    printf "Usage: %s [-f file] [-vql] [files ...]\n" "$0" >&2
    exit 1
    ;;
  *) break
  ;;
  esac

  # necessary, shift arguments left out
  shift
done

printf "\e[32mmanually\e[0m to parse arguments:\n\t\e[33m file %s, verbose %s, quiet %s, long %s\n\e[0m" "$file" "$verbose" "$quiet" "$long"
