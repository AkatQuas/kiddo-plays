# VoxMesh

**Composable speech-AI microservices** — independently deployable services for real-time ASR, batch transcription, speaker embedding, voice wakeup, and TTS.

Each capability is a separate process with its own port and protocol. Scale GPUs per workload, enable only what you need, and wire services together for voice assistants, meeting tools, or batch pipelines.

## Problems this solves

| Problem                                                      | How VoxMesh addresses it                                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Real-time vs batch ASR need different latency and throughput | **Streaming ASR** (WebSocket, long-lived) vs **HTTP ASR** (stateless REST) as separate services |
| Speaker ID, wakeup, and TTS have different resource profiles | Dedicated services — assign GPUs independently                                                  |
| Duplicated LLM / embedding logic across services             | Shared **`voxmesh`** Python library (not a runtime service)                                     |
| Vendor lock-in on models and LLMs                            | FunASR / SenseVoice / Whisper backends; OpenAI-compatible LLM via Ollama                        |
| Hard to run locally without internal infra                   | MIT license, `.env` templates, shell entrypoints, no bundled secrets                            |

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │           Your application              │
                    └─────┬───────────┬───────────┬─────────┬─┘
                          │           │           │         │
                        WS│       HTTP│        WS │         │ HTTP
                          ▼           ▼           ▼         ▼
                   ┌───────────┐ ┌───────────┐ ┌──────┐ ┌──────┐
                   │ Streaming │ │ HTTP ASR  │ │Wake  │ │ TTS  │
                   │    ASR    │ │+ Embedding│ │ up   │ │      │
                   │   :36005  │ │   :36008  │ │:34010│ │:34011│
                   └─────┬─────┘ └─────┬─────┘ └──┬───┘ └──┬───┘
                         │             │          │        │
                         └─────────────┴──────────┴────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Model files      │
                              │  (INPUT_PATH)     │
                              └───────────────────┘
                          ┌─────────▼─────────┐
                          │  LLM (optional)   │
                          │  Ollama :11434    │
                          └───────────────────┘
```

**`voxmesh/`** (shared library) and **`services/`** (runnable microservices) are separated at the repo root. The library provides LLM correction, embedding ports, and app composition roots — imported inside each service, not deployed as its own container.

Details: [docs/architecture/microservices.md](docs/architecture/microservices.md)

## Monorepo (uv workspace)

This repo is a **[uv workspace](https://docs.astral.sh/uv/concepts/projects/workspaces/)** — one shared library plus four service packages. Dependencies are declared in `pyproject.toml` and locked in `uv.lock` (no root `requirements.txt`).

```
voxmesh/                    # workspace root — package: voxmesh
├── pyproject.toml          # workspace config + shared lib deps
├── uv.lock                 # lockfile (commit with dep changes)
├── voxmesh/                # shared Python library
└── services/
    ├── streaming_asr/      # voxmesh-streaming-asr
    ├── offline_asr/        # voxmesh-offline-asr
    ├── wakeup/             # voxmesh-wakeup
    └── tts/                # voxmesh-tts
```

| Package                 | Path                      | Depends on `voxmesh` |
| ----------------------- | ------------------------- | -------------------- |
| `voxmesh`               | repo root                 | —                    |
| `voxmesh-streaming-asr` | `services/streaming_asr/` | yes                  |
| `voxmesh-offline-asr`   | `services/offline_asr/`   | yes                  |
| `voxmesh-wakeup`        | `services/wakeup/`        | no                   |
| `voxmesh-tts`           | `services/tts/`           | no                   |

### Install dependencies

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and [PyTorch](https://pytorch.org/get-started/locally/) first, then:

```bash
# full dev stack (lib + all services)
uv sync --all-packages

# single service
uv sync --package voxmesh-streaming-asr
uv sync --package voxmesh-offline-asr
uv sync --package voxmesh-wakeup
uv sync --package voxmesh-tts

# shared library only
uv sync
```

Without uv, use the pip fallback wrapper:

```bash
./scripts/sync-deps.sh              # all
./scripts/sync-deps.sh streaming      # one service
```

### Manage dependencies

```bash
# add to a service (updates pyproject.toml + uv.lock)
cd services/streaming_asr
uv add httpx

# add to the shared library
uv add --package voxmesh redis

# refresh lockfile after manual pyproject edits
uv lock

# upgrade all locked packages
uv lock --upgrade
```

Commit `pyproject.toml` and `uv.lock` together when changing dependencies.

More detail: [docs/architecture/monorepo.md](docs/architecture/monorepo.md)

## Services

| Service              | Package                 | Protocol                 | Port  | Start                           |
| -------------------- | ----------------------- | ------------------------ | ----- | ------------------------------- |
| Streaming ASR        | `voxmesh-streaming-asr` | WebSocket                | 36005 | `deploy/infer_streaming.sh`     |
| HTTP ASR + Embedding | `voxmesh-offline-asr`   | HTTP                     | 36008 | `deploy/infer_http_asr.sh`      |
| Wakeup               | `voxmesh-wakeup`        | WebSocket                | 34010 | `deploy/infer_wakeup_server.sh` |
| TTS                  | `voxmesh-tts`           | HTTP (OpenAI-compatible) | 34011 | `services/tts/infer.sh`         |
| LLM (external)       | —                       | HTTP                     | 11434 | Ollama / vLLM / etc.            |

## Quick start

### 0. Setup

```bash
./scripts/setup.sh
uv sync --all-packages
```

### 1. Models

```bash
export INPUT_PATH=./models
# Download e.g. SenseVoiceSmall from ModelScope or HuggingFace
```

### 2. LLM (optional — correction & advice)

```bash
ollama pull qwen2.5:7b
cp .env.example .env
```

### 3. Start services

```bash
cd deploy
./infer_streaming.sh
./infer_http_asr.sh
```

### 4. Test streaming ASR

```bash
cd services/streaming_asr
python client.py your_audio.wav ws://localhost:36005
```

## Configuration

| File                                                | Purpose                 |
| --------------------------------------------------- | ----------------------- |
| `.env.example`                                      | Environment template    |
| `services/streaming_asr/common/config.json.example` | Streaming server config |

```bash
cp .env.example .env
cp services/streaming_asr/common/config.json.example services/streaming_asr/common/config.json
```

## Documentation

- [Monorepo & uv workspace](docs/architecture/monorepo.md)
- [Microservices architecture](docs/architecture/microservices.md) ([diagram](docs/diagrams/voxmesh-microservices.svg))
- [Getting started](docs/getting-started.md)
- [WebSocket client protocol](docs/guides/client-integration.md)
- [HTTP ASR API](docs/deployment/http-asr.md)
- [Docker Compose example](deploy/docker-compose.example.yml)

## License

[MIT](LICENSE)

## Acknowledgments

FunASR, SenseVoice, Whisper, CosyVoice, SpeechBrain, Ollama, Qwen2.5
