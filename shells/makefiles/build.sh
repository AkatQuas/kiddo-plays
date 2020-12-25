#! /usr/bin/env bash
#

function echo_info {
  printf  "\033[93m%s\033[0m\n" "$@"
}
function echo_success {
  printf "\033[1;32m%s\033[0m\n" "$@"
}

echo_info "build using shell scripts"

sleep 2

echo_success "build done"
