#!/bin/bash
set -e

function with_green() {
  echo -e "\e[32m$(eval $@)\e[0m"
}
function with_yellow() {
  echo -e "\e[93m$(eval $@)\e[0m"
}

# prerequisites

# commitizen for git commit
if ! command -v git-cz > /dev/null; then
  with_yellow echo "installing commitizen"
  npm install -g commitizen
  npm install -g cz-conventional-changelog
  echo '{ "path": "cz-conventional-changelog" }' > ~/.czrc
  with_green echo "You can use \"git cz\" instead of \"git commit\" and you will find the commitizen prompt."
fi

# nginx
if ! command -v nginx > /dev/null; then
  with_yellow echo "installing nginx"
  brew install nginx
  with_green echo "nginx installed successfully"
fi

# pm2
if ! command -v pm2 > /dev/null; then
  with_yellow echo "installing pm2"
  npm i -g pm2;
  with_green echo "pm2 installed successfully"
fi

# proxychains4
if ! command -v proxychains4 > /dev/null; then
  echo proxychains4 not installed
  brew install proxychains-ng
fi

# check node_modules
(cd projects/server; [ ! -d "node_modules" ] && npm i)
(cd projects/client; [ ! -d "node_modules" ] && npm i)
