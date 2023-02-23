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


function list_and_do_work() {
    local WORKSPACE=/Users/workspace

    # pass all results (joined with space) to sh-exec
    find $WORKSPACE -maxdepth 1 -type d -iname '*target-*' -not -name '*template*' -exec sh -c 'echo "hello $@"' -- {} +


    # pass find results one by one to sh-exec
    find $WORKSPACE -maxdepth 1 -type d -iname '*target-*' -not -name '*template*' -exec sh -c 'echo "hello $@" ' -- {} \;
}
