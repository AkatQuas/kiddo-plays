# voxmesh-tts

CosyVoice2 TTS HTTP microservice (OpenAI-compatible API) for VoxMesh.

## Install (this package only)

```bash
# from repo root
uv sync --package voxmesh-tts
# or
./scripts/sync-deps.sh tts
```

## Run

```bash
./infer.sh
```

Entry point: `api.py`  
Docs: [../../docs/deployment/tts.md](../../docs/deployment/tts.md)
