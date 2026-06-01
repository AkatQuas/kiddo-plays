# ws-mobile workspace

Multi-app frontend workspace shell. Uses `Makefile` + `Procfile` + `.env`.

## Remote dev machine (optional)

Some flows assume a remote build host:

1. Provision a Linux dev VM with Node and Go.
2. `ssh user@<host>` and clone monorepo packages there.
3. Local `npm run dev` may sync sources to the remote host for builds; proxy to the remote service port.

Configure `DEV_USER`, `DEV_BOX_IP`, and repo paths in `.env`.

## Local services

```bash
make help
make _start-redis    # optional docker redis
make start-detail    # example app target — see Makefile
```

See `Procfile` for process names used with Overmind.
