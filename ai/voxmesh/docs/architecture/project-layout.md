# Project layout

## Repository structure

```
voxmesh/
├── voxmesh/            # Shared Python library (LLM, embedding, app roots)
├── services/           # Independently deployable microservices
│   ├── streaming_asr/  # Real-time WebSocket ASR
│   ├── offline_asr/    # HTTP ASR + speaker embedding
│   ├── wakeup/         # Keyword detection
│   └── tts/            # CosyVoice2 HTTP server
├── deploy/             # Shell entrypoints + web debug server
├── docs/               # Documentation and diagrams
├── scripts/            # Developer setup and CI helpers
└── ssl/                # Local TLS (not committed)
```

**Separation of concerns**

| Layer | Path | Role |
|-------|------|------|
| Library | `voxmesh/` | Shared code imported by services — not a runtime process |
| Services | `services/*/` | Runnable microservices with their own entry points |
| Operations | `deploy/`, `scripts/` | How you start, stop, and develop the stack |
| Documentation | `docs/` | Architecture, APIs, deployment guides |

## `voxmesh` package

| Module | Purpose |
|--------|---------|
| `voxmesh.llm` | OpenAI-compatible client, prompts, unified correction |
| `voxmesh.embedding` | `SpeakerEmbeddingPort` + adapters |
| `voxmesh.app` | `StreamingApp` / `OfflineApp` composition roots |
| `voxmesh.path` | `sys.path` bootstrap for services |
| `voxmesh.version` | Reads `voxmesh/version.txt` |

## Streaming ASR layers

```
services/streaming_asr/websocket_asr_server.py
├── transport/          # WebSocket session, protocol, messages
├── pipeline/           # Speaker state serialization
├── service/            # PooledRealtimeSpeechRecognizer
├── model/              # Model pool + ASR backends
├── speaker/            # Embedding + clustering
└── advice/             # Streaming LLM suggestions
```

## Bootstrap

Service entry points import `bootstrap` first:

- `services/streaming_asr/bootstrap.py` — repo root + service dir on `sys.path`
- `services/offline_asr/bootstrap.py` — same pattern

Enables `import voxmesh` without manual path hacks. See `voxmesh.path`.

## Monorepo packages

Each service has its own `pyproject.toml` (uv workspace member). The shared `voxmesh` library is the workspace root package.

See [monorepo.md](monorepo.md) for install commands (`uv sync`, `./scripts/sync-deps.sh`).

## Configuration

| File | Consumer |
|------|----------|
| `.env` | Shell scripts, optional overrides |
| `services/streaming_asr/common/config.json` | Streaming server |

LLM defaults: `http://localhost:11434/v1`, model `qwen2.5:7b`.
