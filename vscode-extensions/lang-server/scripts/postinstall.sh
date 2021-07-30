#!/usr/bin/env bash

pushd client > /dev/null || exit
yarn install
popd || exit

pushd server > /dev/null || exit
yarn install
popd || exit
