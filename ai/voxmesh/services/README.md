# Services

Independently versioned Python packages in the VoxMesh **uv workspace monorepo**. Each directory has its own `pyproject.toml` with service-specific dependencies.

| Directory | PyPI-style name | Protocol | Port | Start |
|-----------|-----------------|----------|------|-------|
| `streaming_asr/` | `voxmesh-streaming-asr` | WebSocket | 36005 | `../deploy/infer_streaming.sh` |
| `offline_asr/` | `voxmesh-offline-asr` | HTTP | 36008 | `../deploy/infer_http_asr.sh` |
| `wakeup/` | `voxmesh-wakeup` | WebSocket | 34010 | `../deploy/infer_wakeup_server.sh` |
| `tts/` | `voxmesh-tts` | HTTP | 34011 | `tts/infer.sh` |

Shared library: [`voxmesh`](../voxmesh/) at the repo root (`voxmesh-streaming-asr` and `voxmesh-offline-asr` depend on it).

## Install dependencies

```bash
# all packages (recommended for development)
./scripts/sync-deps.sh
# or
uv sync --all-packages

# single service
uv sync --package voxmesh-streaming-asr
./scripts/sync-deps.sh streaming
```

Install [PyTorch](https://pytorch.org/get-started/locally/) before running inference.

See [docs/architecture/monorepo.md](../docs/architecture/monorepo.md).
