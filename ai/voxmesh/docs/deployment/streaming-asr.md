# Streaming ASR deployment

Implementation: `services/streaming_asr/websocket_asr_server.py`  
Protocol: [client integration](../guides/client-integration.md)

## Start

```bash
cd deploy
./infer_streaming.sh
./infer_streaming.sh --port 36005 --max_clients 8 --background
```

Direct Python (uses `config.json`, default port 36005):

```bash
cd streaming_asr
python websocket_asr_server.py --port 36005 --max_clients 8
```

## Configuration

Main file: `services/streaming_asr/common/config.json` (from `config.json.example`)

| Block | Purpose |
|-------|---------|
| `network_config` | host, port, max_clients |
| `asr_model_config` | model paths and ASR types |
| `asr_default_params` | VAD, correction, advice, volume detection |
| `knowledge_config` | LLM for AI advice |
| `text_corrector_config` | LLM for text correction |

CLI overrides: `device`, `host`, `port`, `max_clients`, `log_dir`, `session_dir`.

## Environment

| Variable | Purpose |
|----------|---------|
| `ASR_STREAM_PORT` | Port (shell script) |
| `MAX_CLIENT` | Max WebSocket clients |
| `LOG_DIR` | Logs |
| `SESSION_DIR` | Session persistence |
| `INPUT_PATH` | Model root |
| `LLM_*` | OpenAI-compatible LLM |

## Hardware

```bash
./infer_streaming.sh --platform HW   # Huawei Ascend
./infer_streaming.sh --platform MX   # MetaX
```

## Related

- [Microservices architecture](../architecture/microservices.md)
- [Streaming ASR internals](../architecture/streaming-asr.md)
