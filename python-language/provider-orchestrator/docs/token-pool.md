# Token Pool

`TokenPool` balances work across **caller-supplied** credentials.

## Behaviors

| Behavior | Description |
|----------|-------------|
| Sliding window | Each slot allows at most `qps_per_token` acquires per `window_seconds` |
| Round-robin | Next eligible slot is chosen fairly |
| Circuit breaker | After `fail_threshold` rate-limit style failures, slot pauses for `circuit_seconds` |
| Stats | Per-slot in-window count, circuit state, ok/err totals |

## What it is not

- It does **not** mint, scrape, or reverse-engineer third-party session tokens.
- You load tokens/API keys from env, vault, or your own issuer.

## Usage sketch

```python
from provider_orchestrator.pool import TokenPool

pool = TokenPool(tokens=["k1", "k2"], qps_per_token=1.0)

def call_upstream(token: str) -> dict:
    ...

result = pool.try_call(call_upstream, timeout=5.0)
```
