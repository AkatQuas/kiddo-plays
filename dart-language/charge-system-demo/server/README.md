# Charge System Server

A very simple server for the **Charge System** built on [Dart](https://www.dartlang.org/), [Jaguar](https://github.com/Jaguar-dart/jaguar) and [dartis](https://github.com/jcmellado/dartis).

## Requirements

All the data manipulations are built on [redis](https://redis.io/), so no heavy database is needed.

[Install redis](https://redis.io/download) and start it on the background.

## Usage

```bash
git clone git@github.com:AkatQuas/charge-system-demo.git

cd charge-system-demo/server

pub get

# change the port if you need another one
dart bin/server.dart [--port 8080]
```

## Details

This small server runs on `http://localhost:8080` with only 4 API interfaces:

- `/api/login`: For **login**, possible `username`, `password` combination could be found [here](lib/data-sample/user.json)

- `/api/choices`: For **charge choices**, get the available charge choices.

- `/api/charge`: For **charge**, post the charging `value` to make a record of charge

- `/api/history`: For **histroy recap**: get the charging history, look how much you have charged, no paging results for the sake of simplicity.
