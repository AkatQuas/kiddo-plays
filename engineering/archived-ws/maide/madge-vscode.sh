#!/usr/bin/env bash

ENTRY=${HOME}/workspace/maide/vela/extensions/typescript-language-features/out/extension.js
OUTPUT_IMAGE=${HOME}/workspace/maide/graph.svg

madge --image "${OUTPUT_IMAGE}" "${ENTRY}"
# madge --dot "${ENTRY}" > vscode-graph.gv
