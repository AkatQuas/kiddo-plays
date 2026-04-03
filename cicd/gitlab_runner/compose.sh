#!/usr/bin/env bash

HOST_IP="10.1.10.220" \
GITLAB_HOME="$HOME/gitlab-docker" \
docker compose "$@"
