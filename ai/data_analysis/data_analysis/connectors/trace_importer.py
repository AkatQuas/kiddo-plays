"""Trace / telemetry ingestion as a *data source* (Path B).

The service has two ways to get data into an analytical session:
  Path A — DB connectors (Postgres/MySQL/MSSQL/SQLite/File/Excel/CSV)
  Path B — trace import (this module)

The key design decision: traces are treated as an ordinary dataset that lands in
the same in-memory DuckDB session as everything else, so every downstream MDS
pipeline operator (clean/model/EDA/OLAP/SPSS/funnel/waterfall/quality/reverse-ETL)
runs on it uniformly. This module normalizes heterogeneous trace formats (OTLP
JSON, a plain JSON/NDJSON array of spans, or already-tabular CSV/Parquet) into a
single canonical span/event table. It never *collects* traces itself — collection
is a separate optional demo under examples/.
"""

import json
import os
import time
from typing import Any

import pyarrow as pa

# Canonical trace/telemetry schema: one row per span (or event). This superset is
# what every web/trace analytics operator expects, so any imported source is
# reshaped to it and missing fields are filled with NULL rather than omitted.
TRACE_COLUMNS: list[str] = [
    "event_id",
    "trace_id",
    "span_id",
    "parent_span_id",
    "session_id",
    "user_id",
    "event_type",
    "event_name",
    "service_name",
    "page_path",
    "page_url",
    "page_title",
    "status_code",
    "duration_ms",
    "created_at",
    "timestamp_ms",
    "properties",
]


def _iso_from_unix_nano(unix_nano: Any) -> str | None:
    """OTLP timestamps are nanoseconds since epoch, often serialized as strings."""
    if unix_nano in (None, "", 0, "0"):
        return None
    try:
        seconds = int(unix_nano) / 1_000_000_000
        return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(seconds))
    except (ValueError, TypeError):
        return None


def _otlp_attrs_to_dict(attributes: list[dict[str, Any]] | None) -> dict[str, Any]:
    """Flatten OTLP's [{key, value:{stringValue|intValue|...}}] into a plain dict."""
    out: dict[str, Any] = {}
    for attr in attributes or []:
        key = attr.get("key")
        val_obj = attr.get("value", {})
        if not isinstance(val_obj, dict):
            out[key] = val_obj
            continue
        for _vk, vv in val_obj.items():
            out[key] = vv
            break
    return out


class TraceImporter:
    """Normalize trace/telemetry sources into the canonical Arrow table."""

    @staticmethod
    def _blank_row() -> dict[str, Any]:
        return {col: None for col in TRACE_COLUMNS}

    @staticmethod
    def from_otlp(payload: dict[str, Any]) -> list[dict[str, Any]]:
        """Parse an OTLP/JSON traces export (resourceSpans → scopeSpans → spans)."""
        rows: list[dict[str, Any]] = []
        for resource_span in payload.get("resourceSpans", []):
            resource = resource_span.get("resource", {})
            res_attrs = _otlp_attrs_to_dict(resource.get("attributes"))
            service_name = res_attrs.get("service.name", "unknown-service")
            for scope_span in resource_span.get(
                "scopeSpans", resource_span.get("instrumentationLibrarySpans", [])
            ):
                for span in scope_span.get("spans", []):
                    attrs = _otlp_attrs_to_dict(span.get("attributes"))
                    start = span.get("startTimeUnixNano")
                    end = span.get("endTimeUnixNano")
                    duration_ms = None
                    if start and end:
                        try:
                            duration_ms = (int(end) - int(start)) / 1_000_000
                        except (ValueError, TypeError):
                            duration_ms = None
                    status = span.get("status", {}) or {}
                    row = TraceImporter._blank_row()
                    row.update(
                        {
                            "trace_id": span.get("traceId"),
                            "span_id": span.get("spanId"),
                            "parent_span_id": span.get("parentSpanId") or None,
                            "event_id": span.get("spanId"),
                            "session_id": attrs.get("session.id") or attrs.get("session_id"),
                            "user_id": attrs.get("user.id") or attrs.get("user_id"),
                            "event_type": "error"
                            if str(status.get("code", "")).upper().endswith("ERROR")
                            else "span",
                            "event_name": span.get("name"),
                            "service_name": service_name,
                            "page_path": attrs.get("page.path")
                            or attrs.get("http.route")
                            or attrs.get("http.target"),
                            "page_url": attrs.get("page.url") or attrs.get("http.url"),
                            "status_code": str(status.get("code"))
                            if status.get("code") is not None
                            else "OK",
                            "duration_ms": duration_ms,
                            "created_at": _iso_from_unix_nano(start),
                            "timestamp_ms": int(int(start) / 1_000_000) if start else None,
                            "properties": attrs,
                        }
                    )
                    rows.append(row)
        return rows

    @staticmethod
    def from_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Normalize a plain list of span/event dicts to the canonical schema."""
        rows: list[dict[str, Any]] = []
        for rec in records:
            if not isinstance(rec, dict):
                continue
            row = TraceImporter._blank_row()
            for col in TRACE_COLUMNS:
                if col in rec:
                    row[col] = rec[col]
            # Anything not part of the schema is preserved under properties so no
            # signal is silently dropped on import.
            extra = {k: v for k, v in rec.items() if k not in TRACE_COLUMNS}
            existing_props = row.get("properties")
            if isinstance(existing_props, dict):
                existing_props.update(extra)
            elif extra:
                row["properties"] = extra
            rows.append(row)
        return rows

    @staticmethod
    def _fill_defaults(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        now_ms = int(time.time() * 1000)
        for i, row in enumerate(rows):
            if not row.get("event_id"):
                row["event_id"] = f"ev_{i}_{now_ms}"
            if not row.get("event_type"):
                row["event_type"] = "custom"
            if not row.get("created_at"):
                row["created_at"] = now_iso
            if not row.get("timestamp_ms"):
                row["timestamp_ms"] = now_ms
            # properties is stored as a JSON string so DuckDB json_extract works
            # regardless of source, matching how tabular columns are queried.
            props = row.get("properties")
            if isinstance(props, (dict, list)):
                row["properties"] = json.dumps(props, ensure_ascii=False)
            elif props is None:
                row["properties"] = "{}"
        return rows

    @staticmethod
    def to_arrow(rows: list[dict[str, Any]]) -> pa.Table:
        """Build the canonical Arrow table with a stable, explicitly-typed schema."""
        rows = TraceImporter._fill_defaults(rows)
        columns: dict[str, list[Any]] = {col: [] for col in TRACE_COLUMNS}
        for row in rows:
            for col in TRACE_COLUMNS:
                columns[col].append(row.get(col))

        schema = pa.schema(
            [
                ("event_id", pa.string()),
                ("trace_id", pa.string()),
                ("span_id", pa.string()),
                ("parent_span_id", pa.string()),
                ("session_id", pa.string()),
                ("user_id", pa.string()),
                ("event_type", pa.string()),
                ("event_name", pa.string()),
                ("service_name", pa.string()),
                ("page_path", pa.string()),
                ("page_url", pa.string()),
                ("page_title", pa.string()),
                ("status_code", pa.string()),
                ("duration_ms", pa.float64()),
                ("created_at", pa.string()),
                ("timestamp_ms", pa.int64()),
                ("properties", pa.string()),
            ]
        )
        arrays = [pa.array(columns[f.name], type=f.type) for f in schema]
        return pa.Table.from_arrays(arrays, schema=schema)

    @staticmethod
    def load_source(
        source: str | None = None,
        records: list[dict[str, Any]] | None = None,
        fmt: str | None = None,
    ) -> pa.Table:
        """Load trace data from a file path or inline records into Arrow.

        source : file path to .json/.ndjson (OTLP or span array), or .csv/.parquet
                 (already-tabular spans, normalized best-effort by column name).
        records: inline list of span/event dicts (used by the collector demo & tests).
        fmt    : optional override ("otlp", "json", "ndjson", "csv", "parquet").
        """
        if records is not None:
            return TraceImporter.to_arrow(TraceImporter.from_records(records))

        if not source:
            raise ValueError("Either 'source' path or inline 'records' must be provided")

        detected = fmt or os.path.splitext(source)[1].lstrip(".").lower()

        if detected in ("csv", "parquet"):
            # Reuse the file connector, then normalize columns onto the schema.
            from data_analysis.connectors.local import LocalFileConnector

            conn_str = source if "://" in source else f"file://{source}"
            arrow_tbl = LocalFileConnector(conn_str).fetch_to_arrow(
                query_or_table=os.path.basename(source)
            )
            recs = arrow_tbl.to_pylist()
            return TraceImporter.to_arrow(TraceImporter.from_records(recs))

        with open(source, encoding="utf-8") as f:
            text = f.read()

        if detected == "ndjson" or (
            detected not in ("json", "otlp")
            and "\n" in text.strip()
            and not text.strip().startswith("[")
        ):
            recs = [json.loads(line) for line in text.splitlines() if line.strip()]
            return TraceImporter.to_arrow(TraceImporter.from_records(recs))

        obj = json.loads(text)
        if isinstance(obj, dict) and "resourceSpans" in obj:
            return TraceImporter.to_arrow(TraceImporter.from_otlp(obj))
        if isinstance(obj, dict) and "events" in obj and isinstance(obj["events"], list):
            return TraceImporter.to_arrow(TraceImporter.from_records(obj["events"]))
        if isinstance(obj, list):
            return TraceImporter.to_arrow(TraceImporter.from_records(obj))
        raise ValueError(
            f"Unrecognized trace payload in {source!r}: expected OTLP dict, {{events:[...]}}, or a JSON array"
        )
