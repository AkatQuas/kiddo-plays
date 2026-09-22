# Getting started

## Prerequisites

- Python 3.10+
- NVIDIA GPU (recommended) or CPU
- [Ollama](https://ollama.com) (optional, for text correction / AI advice)

## 1. Install

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and [PyTorch](https://pytorch.org/get-started/locally/), then:

```bash
./scripts/setup.sh
uv sync --all-packages          # or: ./scripts/sync-deps.sh
cp .env.example .env
cp services/streaming_asr/common/config.json.example services/streaming_asr/common/config.json
export INPUT_PATH=./models
```

See [monorepo & uv workspace](architecture/monorepo.md) for per-service installs and dependency management.

Download ASR models (e.g. [SenseVoiceSmall](https://www.modelscope.cn/models/iic/SenseVoiceSmall)) into `INPUT_PATH`.

For LLM features:

```bash
ollama pull qwen2.5:7b
```

## 2. Start streaming ASR

```bash
cd deploy
./infer_streaming.sh              # foreground
./start-all.sh                    # streaming + HTTP ASR in background
./status.sh
```

## 3. Test

```bash
cd services/streaming_asr
python client.py your_audio.wav ws://localhost:36005
```

## 4. Start HTTP ASR (with embedding)

```bash
cd deploy
./infer_http_asr.sh
```

```bash
curl -X POST http://localhost:36008/recognition --data-binary @audio.wav

cd services/offline_asr
python embedding_client.py --wav_file test.wav --port 36008
```

## 5. Web debug UI (optional)

```bash
cd deploy
./start_web.sh
```

Open `https://localhost:36004` and point ASR to `ws://localhost:36005`.

## Next

- [Deployment overview](deployment/overview.md)
- [WebSocket protocol](guides/client-integration.md)
- [Microservices architecture](architecture/microservices.md)
