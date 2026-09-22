# Deploy scripts

Shell entrypoints for VoxMesh microservices. Run from this directory or any path.

## Quick start

```bash
cp ../.env.example ../.env
export INPUT_PATH=./models

./infer_streaming.sh
./infer_http_asr.sh --background
./status.sh
./stop.sh http
```

## Scripts

| Script | Service | Default port |
|--------|---------|--------------|
| `infer_streaming.sh` | Streaming ASR (WebSocket) | 36005 |
| `infer_http_asr.sh` | HTTP ASR + embedding | 36008 |
| `infer_wakeup_server.sh` | Voice wakeup | 34010 |
| `start_web.sh` | Browser test page | 36004 |
| `start-all.sh` | Start streaming + HTTP ASR (background) | — |
| `status.sh` | Show background PIDs | — |
| `stop.sh` | Stop background services | — |

## Shared library

`lib/common.sh` provides:

- `.env` loading from repo root
- `INPUT_PATH` validation (HTTP ASR, wakeup)
- NV / HW / MX platform setup
- Background mode with `nohup`, log files, and PID files under `LOG_DIR`

### PID and log files (background mode)

| Service | PID file | Log file |
|---------|----------|----------|
| streaming-asr | `logs/streaming-asr.pid` | `logs/streaming-asr.log` |
| http-asr | `logs/http-asr.pid` | `logs/http-asr.log` |
| wakeup | `logs/wakeup.pid` | `logs/wakeup.log` |

Legacy PID paths from older scripts are still honored by `stop.sh` and `status.sh`.

## Environment

See [`.env.example`](../.env.example). Scripts load `../.env` automatically when present.
