# voxmesh-offline-asr

HTTP batch ASR and speaker embedding microservice for VoxMesh.

## Install (this package only)

```bash
# from repo root
uv sync --package voxmesh-offline-asr
# or
./scripts/sync-deps.sh offline
```

## Run

```bash
cd ../../deploy
./infer_http_asr.sh
```

Entry point: `asr_http_server.py`  
Docs: [../../docs/deployment/http-asr.md](../../docs/deployment/http-asr.md)
