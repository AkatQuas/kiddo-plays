#!/bin/bash
set -e

# prerequisites

# pm2
if ! command -v pm2 > /dev/null; then npm i -g pm2; fi

proxychains4
if ! command -v proxychains4 > /dev/null; then
  echo proxychains4 not installed
  printf '
install example:
    METHOD 1: brew install proxychains-ng
'
  exit 1
fi

if [ ! -f "proxychains.conf" ]; then
  echo proxychains.conf not exists, copy from example
  cp -v proxychains.example.conf proxychains.conf
fi

# check node_modules
([ ! -d "node_modules" ] && npm i)
