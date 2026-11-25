"""Small promises the docs made that the code did not keep."""

import json

import pytest

from data_analysis.cluster.session_manager import duckdb_memory_limit
from data_analysis.config import Settings, settings
from data_analysis.schemas.charts import ChartSpecBuilder


def test_dotenv_file_is_read_and_unknown_keys_do_not_break_startup(tmp_path, monkeypatch):
    # .env.example says "Copy to .env and edit"; the file used to be ignored entirely.
    (tmp_path / ".env").write_text(
        "DATA_ANALYSIS_SESSION_TTL_SECONDS=42\nDATA_ANALYSIS_ENABLE_RAY=false\nDATA_ANALYSIS_MAX_SESSIONS=7\n"
    )
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("DATA_ANALYSIS_SESSION_TTL_SECONDS", raising=False)
    loaded = Settings()
    assert loaded.SESSION_TTL_SECONDS == 42 and loaded.MAX_SESSIONS == 7
    monkeypatch.setenv("DATA_ANALYSIS_SESSION_TTL_SECONDS", "99")
    assert Settings().SESSION_TTL_SECONDS == 99  # real environment wins


def test_vega_lite_specs_carry_a_schema_key():
    # The key was written as "" in all three builders, so no spec was valid Vega-Lite.
    specs = [
        ChartSpecBuilder.build_waterfall_chart([{"dim": "a", "delta": 1.0}], "dim", "delta"),
        ChartSpecBuilder.build_scatter_regression_chart([{"x": 1, "y": 2}], "x", "y"),
        ChartSpecBuilder.build_time_series_forecast_chart(
            [{"time": "2026-01", "value": 1.0}],
            [{"step": 1, "predicted_value": 2.0, "ci_95_lower": 1.0, "ci_95_upper": 3.0}],
            "time",
            "value",
        ),
    ]
    for spec in specs:
        assert "" not in spec
        assert spec["$schema"] == "https://vega.github.io/schema/vega-lite/v5.json"


def test_duckdb_memory_limit_auto_and_explicit(monkeypatch):
    monkeypatch.setattr(settings, "DUCKDB_MEMORY_LIMIT", "auto")
    auto = duckdb_memory_limit()
    assert auto.endswith("MB") and 512 <= int(auto[:-2]) <= 16 * 1024
    monkeypatch.setattr(settings, "DUCKDB_MEMORY_LIMIT", "3GB")
    assert duckdb_memory_limit() == "3GB"


def test_mcp_transport_setting_is_honoured(monkeypatch):
    import data_analysis.mcp_server as server

    calls = []
    monkeypatch.setattr(server.mcp, "run", lambda *a, **kw: calls.append(kw))
    monkeypatch.setattr(settings, "MCP_TRANSPORT", "stdio")
    server.run_server()
    monkeypatch.setattr(settings, "MCP_TRANSPORT", "http")
    monkeypatch.setattr(settings, "MCP_SSE_PORT", 8123)
    server.run_server()
    assert calls == [{}, {"transport": "http", "host": settings.MCP_HOST, "port": 8123}]
    monkeypatch.setattr(settings, "MCP_TRANSPORT", "carrier-pigeon")
    with pytest.raises(ValueError):
        server.run_server()


def test_mcp_tools_stay_plain_callables_and_report_webhook_failure():
    import data_analysis.mcp_server as server

    out = json.loads(server.send_operational_webhook_alert("http://127.0.0.1:1/x", "t", "m"))
    assert out["status"] == "error" and out["alert_result"]["rejected"] is True


def test_dashboard_sends_the_api_key_and_uses_a_strong_session_id():
    from pathlib import Path

    import data_analysis

    js = (Path(data_analysis.__file__).parent / "web" / "static" / "dashboard.js").read_text(
        encoding="utf-8"
    )
    assert "X-API-Key" in js and "Math.random" not in js.split("SAMPLE_TRACES")[0]
    assert "await fetch(" not in js.replace("=> fetch(path", "")
