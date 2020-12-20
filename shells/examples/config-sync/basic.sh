#! /usr/env bash

cNone='\033[00m'
cRed='\033[01;31m'
cGreen='\033[01;32m'
cYellow='\033[01;33m'
cPurple='\033[01;35m'
cCyan='\033[01;36m'
cWhite='\033[01;37m'
cBold='\033[1m'
cUnderline='\033[4m'

MAPPINGS=(
  # shell
  ".zshrc:~/.zshrc"
  ".bash_profile:~/.bash_profile"

  # git
  ".gitconfig:~/.gitconfig"
  ".gitignore:~/.gitignore"

  # node
  ".npmrc:~/.npmrc"
  ".yarnrc:~/.yarnrc"

  # misc
  ".czrc:~/.czrc"
  ".vimrc:~/.vimrc"
  "plugins.vim:~/.vim/plugins.vim"
  ".ideavimrc:~/.ideavimrc"

  # vscode
  "vscode-settings.json:~/Library/Application\ Support/Code/User/settings.json"
  "reactx.code-snippets:~/Library/Application\ Support/Code/User/snippets/reactx.code-snippets"
  "js-ts.code-snippets:~/Library/Application\ Support/Code/User/snippets/js-ts.code-snippets"
  )
