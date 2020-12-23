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

pushd config-sync > /dev/null || exit
pwd
popd > /dev/null || exit
pwd
