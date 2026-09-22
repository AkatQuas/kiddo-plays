# VoxMesh documentation

VoxMesh is a **speech-AI microservices toolkit** shipped as a **uv workspace monorepo**. Each capability runs as its own process and Python package under `services/`. See [monorepo](architecture/monorepo.md) and [microservices architecture](architecture/microservices.md).

Protocol details for streaming ASR: [client integration](guides/client-integration.md).

## Getting started

- [Getting started](getting-started.md)

## Deployment

| Doc                                          | Code                                             |
| -------------------------------------------- | ------------------------------------------------ |
| [Overview](deployment/overview.md)           | `deploy/*.sh`                                    |
| [Streaming ASR](deployment/streaming-asr.md) | `services/streaming_asr/websocket_asr_server.py` |
| [HTTP ASR](deployment/http-asr.md)           | `services/offline_asr/asr_http_server.py`        |
| [Embedding](deployment/embedding.md)         | `services/offline_asr/embedding_service.py`      |
| [Wakeup](deployment/wakeup.md)               | `services/wakeup/wakeup_server.py`               |
| [TTS](deployment/tts.md)                     | `services/tts/api.py`                            |

## Integration

| Doc                                                       | Description                   |
| --------------------------------------------------------- | ----------------------------- |
| [WebSocket client protocol](guides/client-integration.md) | Streaming ASR (authoritative) |
| [Web test page](guides/web-asr-client.html)               | Browser microphone debug UI   |

## Diagrams

Architecture SVGs live in [diagrams/](diagrams/README.md).

## Architecture

| Doc                                                      | Description                               |
| -------------------------------------------------------- | ----------------------------------------- |
| [Microservices](architecture/microservices.md)           | Service boundaries, integration patterns  |
| [Project layout](architecture/project-layout.md)         | `voxmesh` package, bootstrap, directories |
| [Streaming ASR internals](architecture/streaming-asr.md) | Model pool, VAD pipeline                  |
| [Speaker embedding](architecture/speaker-embedding.md)   | Embedding + clustering                    |
| [Streaming advice](architecture/streaming-advice.md)     | LLM advice mechanism                      |
