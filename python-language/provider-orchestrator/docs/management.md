# Management architecture

Management is treated as a peer concern to runtime scheduling.

## Surfaces

| Area | Responsibility |
|------|----------------|
| Key registry | CRUD-ish add/list, active flag, public views (secret redacted) |
| Quota windows | Hour / month counters with window reset |
| Token pool stats | Live slot capacity and circuit state |
| Session broker | Account-id addressing; mark expired on auth errors |
| Dispatch demo API | Exercise scheduler without embedding a real product |

## Security baseline

- Configure `MANAGEMENT_API_TOKEN` (header `X-Api-Token`).
- Never return full `access_key` / session credentials from list APIs.
- Bind management listeners to localhost in development
  (`MANAGEMENT_HOST=127.0.0.1`).

## Optional API

```bash
pip install -e ".[api]"
export MANAGEMENT_API_TOKEN=dev-token
export DEMO_PROVIDER_KEYS=k1,k2
uvicorn provider_orchestrator.management.app:app --host 127.0.0.1 --port 8080
```
