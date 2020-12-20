#! /bin/bash

set -e

# shellcheck source=./basic.sh
source $PWD/basic.sh

for i in "${!MAPPINGS[@]}"; do
  filename=$(echo "${MAPPINGS[$i]}" | awk 'BEGIN { FS=":" }  { print $1 }')
  fromlocation=$(echo "${MAPPINGS[$i]}" | awk 'BEGIN { FS=":" }  { print $2 }')
  tolocation=$PWD/confs/$filename
  sh -c "printf \"copy $cRed$filename$cNone from $cYellow$fromlocation$cNone to $cGreen$tolocation$cNone\n\""
  sh -c "cp $fromlocation $tolocation"
done
