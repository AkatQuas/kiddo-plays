# voxmesh-wakeup

Voice wakeup WebSocket microservice for VoxMesh.

## Install (this package only)

```bash
# from repo root
uv sync --package voxmesh-wakeup
# or
./scripts/sync-deps.sh wakeup
```

## Run

```bash
cd ../../deploy
./infer_wakeup_server.sh
```

Entry point: `wakeup_server.py`  
Docs: [../../docs/deployment/wakeup.md](../../docs/deployment/wakeup.md)
