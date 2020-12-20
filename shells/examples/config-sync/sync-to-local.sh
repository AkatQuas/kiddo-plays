#! /bin/bash

set -e

source ./basic.sh

for i in "${!MAPPINGS[@]}"; do
  filename=$(echo "${MAPPINGS[$i]}" | awk 'BEGIN { FS=":" }  { print $1 }')
  tolocation=$(echo "${MAPPINGS[$i]}" | awk 'BEGIN { FS=":" }  { print $2 }')
  fromlocation=$PWD/confs/$filename

  read -r -p "Do you wish to back the $filename?" yn
  case $yn in
      [Yy]* ) sh -c "cp $tolocation $tolocation.bak" && printf '%sbacked ok%s\n' "$cCreen" "$cNone";;
      * ) printf '%sSkipping%s\n' "$cYellow" "$cNone";;
  esac

  sh -c "printf \"copy $cRed$filename$cNone from $cYellow$fromlocation$cNone to $cGreen$tolocation$cNone\n\""

  sh -c "cp $fromlocation $tolocation"
done
