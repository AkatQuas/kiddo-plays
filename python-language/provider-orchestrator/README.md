# Provider Orchestrator

Layered **multi-provider runtime patterns** for Python:

- **Scheduler** — cache → credential pick → provider call → fallback
- **Token pool** — sliding-window QPS + circuit breaker across supplied keys
- **Key / quota management** — round-robin, hour/month windows, redacted admin views
- **Session broker** — account-id → opaque credential → upstream wrapper
- **Worker / proxy composition** — educational sticky binding & health flags

Product features (search, retrieval, domain APIs, …) plug in as **replaceable
adapters**. This repo focuses on orchestration architecture, not on any single
product vertical.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env

PYTHONPATH=src python examples/basic_dispatch.py
PYTHONPATH=src python examples/token_pool_demo.py
PYTHONPATH=src python examples/session_broker_demo.py
PYTHONPATH=src python examples/proxy_learning_demo.py
pytest
```

Optional management API:

```bash
pip install -e ".[api]"
export MANAGEMENT_API_TOKEN=dev-token
export DEMO_PROVIDER_KEYS=k1,k2
uvicorn provider_orchestrator.management.app:app --host 127.0.0.1 --port 8080
```

## Layout

```
src/provider_orchestrator/
  ports/          # CachePort, KeyStorePort, ProductAdapter
  keys/           # ProviderKey, KeyRegistry, InMemoryKeyStore
  pool/           # TokenPool
  scheduler/      # Dispatcher + InMemoryCache
  session/        # SessionBroker
  workers/        # WorkerPool
  proxy/          # ProxyPool (learning only)
  adapters/       # Echo + static fallback demos
  management/     # Optional FastAPI surface
docs/             # Architecture notes
examples/         # Runnable sketches
```

## Configuration

All secrets and tunables come from environment variables. See `.env.example`.

| Variable | Purpose |
|----------|---------|
| `DEMO_PROVIDER_KEYS` | Comma-separated demo credentials |
| `KEY_HOUR_LIMIT` / `KEY_MONTH_LIMIT` | Soft quota defaults |
| `TOKEN_POOL_SIZE` / `TOKEN_POOL_QPS_PER_TOKEN` | Pool behavior |
| `MANAGEMENT_API_TOKEN` | Management API header token |
| `LEARNING_PROXY_URLS` | Optional educational proxy list |
| `LEARNING_PROXY_ENABLED` | Explicit opt-in for proxy demos |

## Proxy disclaimer

Residential / datacenter proxies appear only as a **learning and discussion**
technique (sticky sessions, failure marking, health-screen hooks). They are
**not** offered as a commercial capability. See [docs/proxy-learning.md](docs/proxy-learning.md)
and [NOTICE.md](NOTICE.md).

## Non-goals

- Shipping crawlers or scrapers
- Browser stealth / anti-detect stacks
- Reverse-engineering private app protocols
- Embedding real production credentials

## License

MIT — see [LICENSE](LICENSE).
