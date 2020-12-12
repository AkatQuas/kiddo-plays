#/bin/bash
#

function echo_info {
  echo "\033[93m$@\033[0m"
}
function echo_success {
  echo "\033[1;32m$(eval $@)\033[0m"
}

echo_info "build using shell scripts"

sleep 2

echo_success echo "build done"
