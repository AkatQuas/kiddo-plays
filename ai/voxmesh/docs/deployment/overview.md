# Deployment overview

VoxMesh uses **microservice deployment**: each capability is a separate process and port. See [architecture](../architecture/microservices.md).

## Services and ports

| Service | Script | Default port | Notes |
|---------|--------|--------------|-------|
| Streaming ASR | `deploy/infer_streaming.sh` | **36005** | WebSocket |
| HTTP ASR + Embedding | `deploy/infer_http_asr.sh` | **36008** | `/recognition`, `/embedding_extract` |
| HTTP ASR (direct) | `python services/offline_asr/asr_http_server.py` | **34001** | CLI default if no script |
| Wakeup | `deploy/infer_wakeup_server.sh` | **34010** | WebSocket |
| TTS | `services/tts/infer.sh` | **34011** | OpenAI-compatible HTTP |
| Web debug UI | `deploy/start_web.sh` | **36004** | Static test page only |

## Hardware platforms

| Code | Platform | Enable |
|------|----------|--------|
| NV | NVIDIA GPU | default |
| HW | Huawei Ascend NPU | `--platform HW` |
| MX | MetaX GPU | `--platform MX` |

## Environment

```bash
export INPUT_PATH=./models
export LLM_API_URL=http://localhost:11434/v1
export LLM_MODEL=qwen2.5:7b
export LLM_API_KEY=ollama
```

Full list: [`.env.example`](../../.env.example).

## Background processes

```bash
cd deploy
./infer_streaming.sh --background
./infer_http_asr.sh --background
./status.sh
./stop.sh          # stop all
./stop.sh http     # stop one service
```

PID files: `logs/streaming-asr.pid`, `logs/http-asr.pid`, `logs/wakeup.pid`  
Log files: `logs/*.log`

See [deploy/README.md](../../deploy/README.md).

## Docs

- [Getting started](../getting-started.md)
- [Streaming ASR](streaming-asr.md)
- [HTTP ASR](http-asr.md)
- [Client protocol](../guides/client-integration.md)
