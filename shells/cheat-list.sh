#!/bin/bash

###
# checking the available command

if [ -x "$(command -v git)" ]
then
    echo "SUCCESS: Git is installed"
else
    echo "ERROR: Git does not seem to be installed."
    echo "Please download Git using your package manager or over https://git-scm.com/!"
    exit 1
fi

if command -v git > /dev/null
then
  echo "SUCCESS: Git is installed"
else
    echo "ERROR: Git does not seem to be installed."
fi

###
# detect node_modules installed

function ensure_node_modules() {
    cd "$1" || exit
    if [ ! -d "node_modules" ]
    then
        yarn
    fi
}
