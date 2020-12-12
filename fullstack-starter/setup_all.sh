#!/bin/bash
set -e

function echo_green() {
  echo -e "\033[1;32m$@\033[0m"
}
function echo_yellow() {
  echo -e "\033[93m$@\033[0m"
}

# prerequisites

# commitizen for git commit
if ! command -v git-cz > /dev/null; then
  echo_yellow "installing commitizen"
  npm install -g commitizen
  npm install -g cz-conventional-changelog
  echo '{ "path": "cz-conventional-changelog" }' > ~/.czrc
  echo_green  "You can use \"git cz\" instead of \"git commit\" and you will find the commitizen prompt."
fi

# nginx
if ! command -v nginx > /dev/null; then
  echo_yellow "installing nginx"
  brew install nginx
  echo_green "nginx installed successfully"
fi

# pm2
if ! command -v pm2 > /dev/null; then
  echo_yellow "installing pm2"
  npm i -g pm2;
  echo_green "pm2 installed successfully"
fi

# proxychains4
if ! command -v proxychains4 > /dev/null; then
  echo_yellow "proxychains4 not installed"
  brew install proxychains-ng
  echo_green "proxychains4 installed successfully"
fi

# check node_modules
(cd projects/server; [ ! -d "node_modules" ] && npm i)
(cd projects/client; [ ! -d "node_modules" ] && npm i)
