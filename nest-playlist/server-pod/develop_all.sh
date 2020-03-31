#!/bin/bash
set -e

# start services
pm2 start ecosystem.config.js $@

printf 'NOTE 1:
you should run redis by yourself
'

printf 'NOTE 2:
  - get current running processes: pm2 ls
  - get logs: pm2 logs
  - get one process logs: pm2 logs server / ...
  - remove all processes: pm2 delete all
  - restart one process: pm2 restart server / ...
'

printf 'NOTE 3:
  - server at 3300
'
