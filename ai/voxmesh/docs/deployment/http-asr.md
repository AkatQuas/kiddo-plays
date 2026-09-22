# HTTP ASR deployment and API

Implementation: `services/offline_asr/asr_http_server.py`

## Start

```bash
cd deploy
./infer_http_asr.sh
./infer_http_asr.sh --port 36008 --background
```

Direct Python (CLI default port 34001; use `--port 36008` to match deploy script):

```bash
cd offline_asr
export INPUT_PATH=./models
python asr_http_server.py --port 36008
```

## Environment

| Variable | Default | Purpose |
|----------|---------|---------|
| `ASR_HTTP_PORT` | 36008 | Port (shell script) |
| `INPUT_PATH` | — | Model root |
| `DEVICE` | cuda:0 | Device |
| `HOTWORD_API_URL` | http://localhost:11434/v1 | Hotword correction LLM |
| `HOTWORD_MODEL` | qwen2.5:7b | Model name |

## API

Response wrapper `AsrResponse`:

```json
{"msg": "", "code": 0, "data": {}}
```

### `POST /recognition`

Sync transcription. Body: raw audio bytes (converted to WAV server-side).

Response `data`:

```json
{
  "text": "full transcript",
  "sentences": [{"text": "...", "start": 0, "end": 1000, "spk": 0}],
  "version": "2.4.1.1"
}
```

Max duration: 2 hours. Sync endpoint does **not** accept `hotword` / `speakers`.

### `POST /async_recognition`

```json
{
  "filekey": "remote-object-key",
  "filePath": "/local/path/audio.wav",
  "hotword": ["term1"],
  "speakers": [],
  "spk_num": 0,
  "lang": "zh"
}
```

| Field | Notes |
|-------|-------|
| `filePath` | Local path on server (preferred if exists) |
| `filekey` | Remote key; downloaded via optional OSS config |
| `hotword` | Async only |
| `lang` | `zh` or `en` |

Returns `query_id` and `audio_duration`. Poll with `GET /get_recognition`.

### `GET /get_recognition?query_id=...`

| code | Meaning |
|------|---------|
| 0 | Done |
| 1 | Error / not found |
| 2 | In progress |

### `POST /embedding_extract`

Speaker embedding — see [embedding](embedding.md).

### `GET /health`

Service and model load status.

## Optional OSS download

For async `filekey` fetch: set `OSS_ENDPOINT`, `API_KEY`, `API_SECRET`, `OSS_QUERY_PARAM` in `.env`.
