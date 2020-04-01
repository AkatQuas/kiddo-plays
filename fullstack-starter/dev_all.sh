#!/bin/bash

# prerequisites
if [ ! -f "proxychains.conf" ]; then
  echo proxychains.conf not exists, copy from example
  cp -v proxychains.example.conf proxychains.conf
fi

# start services
pm2 start ecosystem.config.js $@

printf 'NOTE 1:
maybe you should run redis by yourself
'

printf 'NOTE 2:
  - get current running processes: pm2 ls
  - get logs: pm2 logs
  - get one process logs: pm2 logs client / pm2 logs server / ...
  - remove all processes: pm2 delete all
  - restart one process: pm2 restart client / ...
'

printf 'NOTE 3:
open http://localhost:8000/#/
  - gateway 8000
  - client 4200
  - server 8080
'
