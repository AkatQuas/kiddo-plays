# agent-websearch

A small FastAPI service for **agent / RAG** workloads:

1. **Official search API orchestration** — call providers such as Tavily, SerpAPI, TinyFish, and Brave Search API with ordered fallback.
2. **HTML parsers** — turn product detail / list HTML you already have into structured JSON (no network I/O in the parser).
3. **S3-compatible storage adapter** — upload, download, and presign via the **boto3** SDK against any S3 API endpoint (AWS S3, MinIO, and other S3-compatible gateways).

Secrets never ship in code. Copy `.env.example` to `.env` and fill placeholders.

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# set at least API_BEARER_TOKEN; add provider keys as needed

uvicorn agent_websearch.app:app --host 0.0.0.0 --port 9030
# or: python -m agent_websearch.app
```

Health (no auth):

```bash
curl -s http://127.0.0.1:9030/health
```

Search:

```bash
curl -s http://127.0.0.1:9030/v1/search \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"open source vector database","max_results":5}'
```

Parse HTML:

```bash
curl -s http://127.0.0.1:9030/v1/parse/amazon/product \
  -H "Authorization: Bearer $API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'EOF'
{"html":"<html>...</html>","asin":"B0EXAMPLE01"}
EOF
```

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | no | Liveness + configured providers |
| POST | `/v1/search` | Bearer | Multi-provider web search |
| POST | `/v1/parse/amazon/product` | Bearer | Product detail HTML → JSON |
| POST | `/v1/parse/amazon/list` | Bearer | Search/list HTML → JSON |
| POST | `/v1/storage/presign` | Bearer | S3 presigned URL |

Unified response shape:

```json
{
  "crawled_time": "2026-01-01 12:00:00",
  "result": [],
  "status": "success",
  "cost": 0.123,
  "status_msg": null,
  "source": "tavily"
}
```

Force a provider with `"source": "tavily"` (or `serpapi` / `tinyfish` / `brave`). Otherwise providers run in `SEARCH_PROVIDER_ORDER` until one returns hits.

## Configuration

See [`.env.example`](.env.example). Important variables:

- `API_BEARER_TOKEN` — required for protected routes
- `TAVILY_API_KEY` / `SERPAPI_API_KEY` / `TINYFISH_API_KEY` / `BRAVE_API_KEY` — comma-separated keys; empty means skip that provider
- `SEARCH_PROVIDER_ORDER` — fallback order
- `SENSITIVE_WORDS_PATH` — optional local blocklist file (one phrase per line)
- `S3_ENDPOINT_URL`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`

## Extension: scheduled crawl + store + index

This project intentionally **does not** ship site-specific crawlers or anti-bot tooling.

You can still build a fast local lookup path yourself:

1. **Schedule** — run a cron / worker on a timer under your own compliance rules (public APIs, licensed feeds, or pages you are allowed to collect).
2. **Parse** — feed acquired HTML into `/v1/parse/...` or the `agent_websearch.parsers` library.
3. **Store** — write blobs to S3-compatible storage (`S3Storage`) and metadata to your database of choice.
4. **Index** — build inverted / vector indexes over titles, snippets, and structured fields.
5. **Serve** — query the index first; if miss, fall back to `/v1/search` official APIs.

That pattern keeps hot lookups local while using paid search APIs as a safety net.

## What this project is not

- Not a bypass toolkit for website access controls or CAPTCHAs
- Not a substitute for each provider’s terms of service
- Not a place to commit API keys, cookies, or private HTML dumps

Use responsibly and only against data sources you are permitted to access.

## Development

```bash
pytest
```

## License

MIT — see [LICENSE](LICENSE).
