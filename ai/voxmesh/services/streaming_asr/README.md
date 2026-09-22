# voxmesh-streaming-asr

Real-time WebSocket ASR microservice for VoxMesh.

## Install (this package only)

```bash
# from repo root
uv sync --package voxmesh-streaming-asr
# or
./scripts/sync-deps.sh streaming
```

Requires [PyTorch](https://pytorch.org/get-started/locally/) and models under `INPUT_PATH`.

## Run

```bash
cd ../../deploy
./infer_streaming.sh
```

Entry point: `websocket_asr_server.py`  
Docs: [../../docs/deployment/streaming-asr.md](../../docs/deployment/streaming-asr.md)
