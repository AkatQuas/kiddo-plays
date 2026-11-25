import json

from data_analysis.connectors.trace_importer import TRACE_COLUMNS, TraceImporter


def test_from_records_normalizes_to_canonical_schema():
    tbl = TraceImporter.load_source(
        records=[
            {"event_name": "click", "user_id": "u1", "custom_field": "x"},
        ]
    )
    assert tbl.column_names == TRACE_COLUMNS
    row = tbl.to_pylist()[0]
    assert row["event_name"] == "click"
    assert row["user_id"] == "u1"
    # Non-schema fields are preserved under properties, never dropped.
    assert "custom_field" in json.loads(row["properties"])
    # Defaults are filled so downstream operators never see missing columns.
    assert row["event_id"] and row["event_type"] and row["timestamp_ms"]


def test_from_otlp_export():
    otlp = {
        "resourceSpans": [
            {
                "resource": {
                    "attributes": [{"key": "service.name", "value": {"stringValue": "checkout"}}]
                },
                "scopeSpans": [
                    {
                        "spans": [
                            {
                                "traceId": "t1",
                                "spanId": "s1",
                                "name": "GET /cart",
                                "startTimeUnixNano": "1700000000000000000",
                                "endTimeUnixNano": "1700000000120000000",
                                "attributes": [
                                    {"key": "http.route", "value": {"stringValue": "/cart"}}
                                ],
                                "status": {"code": "STATUS_CODE_OK"},
                            }
                        ],
                    }
                ],
            }
        ],
    }
    tbl = TraceImporter.to_arrow(TraceImporter.from_otlp(otlp))
    rows = tbl.to_pylist()
    assert len(rows) == 1
    r = rows[0]
    assert r["trace_id"] == "t1" and r["span_id"] == "s1"
    assert r["service_name"] == "checkout"
    assert r["event_name"] == "GET /cart"
    assert r["page_path"] == "/cart"
    assert abs(r["duration_ms"] - 120.0) < 1e-6


def test_load_source_from_json_file(tmp_path):
    p = tmp_path / "spans.json"
    p.write_text(
        json.dumps(
            [
                {"event_name": "view", "user_id": "u1", "trace_id": "t1", "span_id": "s1"},
                {
                    "event_name": "buy",
                    "user_id": "u1",
                    "trace_id": "t1",
                    "span_id": "s2",
                    "parent_span_id": "s1",
                },
            ]
        ),
        encoding="utf-8",
    )
    tbl = TraceImporter.load_source(source=str(p))
    assert tbl.num_rows == 2
    assert set(tbl.column_names) == set(TRACE_COLUMNS)


def test_load_source_from_otlp_wrapped_events_key(tmp_path):
    p = tmp_path / "events.json"
    p.write_text(
        json.dumps({"events": [{"event_name": "ping", "user_id": "u9"}]}), encoding="utf-8"
    )
    tbl = TraceImporter.load_source(source=str(p))
    assert tbl.num_rows == 1
    assert tbl.to_pylist()[0]["user_id"] == "u9"
