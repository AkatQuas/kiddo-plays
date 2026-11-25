# data_analysis

**Disclaimer:** This is a **weekend learning project**. It is **not production-ready** — no SLA, hardened multi-tenant security, or operational runbooks. Use at your own risk.

In-memory **DuckDB + Apache Arrow** analytics with REST and MCP surfaces for experimenting with agent-driven data workflows.

## Quick start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
DATA_ANALYSIS_REQUIRE_AUTH=false uvicorn data_analysis.main:app --reload
```

- Dashboard: `http://127.0.0.1:8000/dashboard`
- OpenAPI: `http://127.0.0.1:8000/docs`

MCP (stdio):

```bash
DATA_ANALYSIS_REQUIRE_AUTH=false python -m data_analysis.mcp_server
```

## Showcase: Team Spirit (Dota 2)

Fetch fresh public match data from OpenDota (not bundled in git):

```bash
python examples/dota2-showcase/fetch_opendota.py --team 7119388 --limit 30
```

Then run the built-in example via REST or the dashboard.

## Docker (local only)

```bash
docker build -t data_analysis:local .
docker run --rm -p 8000:8000 -e DATA_ANALYSIS_REQUIRE_AUTH=false data_analysis:local
```

See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for scope and limitations.

## License

MIT — see [LICENSE](LICENSE).