# Voice wakeup deployment

Implementation: `services/wakeup/wakeup_server.py`

## Start

```bash
cd deploy
./infer_wakeup_server.sh
```

Default: WebSocket port **34010**.

## Behavior

- Streams audio over WebSocket
- Keyword matching with phonetic fuzzy logic (pypinyin + fuzzywuzzy)
- Default keyword configurable in server args

## Typical use

```
Client mic → Wakeup (:34010) → on hit, connect Streaming ASR (:36005)
```

See [microservices architecture](../architecture/microservices.md).
