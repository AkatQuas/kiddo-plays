# Speaker embedding

Implementation: `services/offline_asr/embedding_service.py`  
Runs in the **HTTP ASR** process (`:36008`).

## Endpoint

`POST /embedding_extract`

```json
{
  "wav_data": "<base64-encoded WAV file>"
}
```

Requirements:

- Valid WAV (RIFF/WAVE header)
- Minimum duration: 10 seconds (configurable via `--min_duration`)

Success `data`:

```json
{
  "model_name": "campplus",
  "embedding": "<base64 float32 vector>",
  "wav_duration": 12.5
}
```

## Client

```bash
cd offline_asr
python embedding_client.py --wav_file sample.wav --port 36008
```

## Streaming ASR

Pre-register speakers via WebSocket `init` → `params.speakers` (see [client integration](../guides/client-integration.md)).

Architecture: [speaker embedding](../architecture/speaker-embedding.md)
