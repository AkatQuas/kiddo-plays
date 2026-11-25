"""Run the S0 local baseline. Results are diagnostic, never a performance promise."""

import argparse
import hashlib
import importlib.metadata
import json
import os
import platform
import resource
import statistics
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from tests.fixtures.generators.table_fixture import ROOT, generate, profile


def source_snapshot():
    paths = [
        *(ROOT / "tests/fixtures").rglob("*.py"),
        *(ROOT / "tests/fixtures/specs").glob("*.json"),
        *(ROOT / "app").rglob("*.py"),
    ]
    return {
        str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)
    }


def timed(fn):
    start = time.perf_counter()
    result = fn()
    return result, round((time.perf_counter() - start) * 1000, 3)


def distribution(values):
    ordered = sorted(values)
    return {
        "samples_ms": values,
        "p50_ms": statistics.median(values),
        "p95_ms": ordered[max(0, __import__("math").ceil(len(values) * 0.95) - 1)],
        "sample_count": len(values),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=("tiny", "small", "large", "stress"), required=True)
    parser.add_argument("--out", required=True, help="New directory outside this repository")
    parser.add_argument("--repeat", type=int, default=3)
    parser.add_argument("--threads", type=int, default=2)
    parser.add_argument(
        "--fixture-dir", help="Reuse a previously generated matching fixture outside the repository"
    )
    args = parser.parse_args()
    if not 1 <= args.repeat <= 20 or not 1 <= args.threads <= 8:
        parser.error("repeat must be 1..20; threads must be 1..8")
    out = Path(args.out).resolve()
    if out.is_relative_to(ROOT):
        parser.error("output must be outside the repository")
    out.mkdir(parents=True, exist_ok=False)
    sources = source_snapshot()
    fixture_dir = Path(args.fixture_dir).resolve() if args.fixture_dir else out / "fixture"
    if fixture_dir.is_relative_to(ROOT):
        parser.error("fixture must be outside the repository")
    if args.fixture_dir:
        from tests.fixtures.verify import read_fixture

        manifest, _ = read_fixture(fixture_dir)
        if manifest["config"] != profile(args.profile):
            raise ValueError("Reused fixture does not match the requested frozen profile")
        generation_ms = None
    else:
        manifest, generation_ms = timed(lambda: generate(profile(args.profile), fixture_dir))
    # This isolated process writes metadata/upload files only under its own run directory.
    os.chdir(out)
    os.environ["DATA_ANALYSIS_API_KEYS"] = "s0-local-only-a,s0-local-only-b"
    os.environ["DATA_ANALYSIS_DUCKDB_THREADS"] = str(args.threads)
    os.environ["DATA_ANALYSIS_DUCKDB_MEMORY_LIMIT"] = "512MB"
    os.environ["DATA_ANALYSIS_MAX_TOTAL_MEMORY_MB"] = "2048"
    os.environ["DATA_ANALYSIS_UPLOAD_DIR"] = str(out / "uploads")
    from data_analysis.cluster.session_manager import SessionManager
    from data_analysis.connectors.excel_reader import FastExcelReader
    from data_analysis.operators.sandbox import run_duckdb_sql
    from tests.fixtures.verify import (
        QUERIES,
        assert_query_results,
        read_fixture,
        verify_full_rows,
        verify_queries,
    )

    _, expected = read_fixture(fixture_dir)
    mgr = SessionManager()
    durations = {
        name: [] for name in ("parse", "register", "full_row_check", "cold_sql", "warm_sql")
    }
    counts = []
    for _ in range(args.repeat):
        table, ms = timed(
            lambda: FastExcelReader.read_xlsx_to_arrow(str(fixture_dir / "table.xlsx"))
        )
        durations["parse"].append(ms)
        _, ms = timed(lambda: verify_full_rows(table, fixture_dir, expected))
        durations["full_row_check"].append(ms)
        session = mgr.get_or_create_session()
        try:
            _, ms = timed(lambda: session.register_dataset("facts", table))
            durations["register"].append(ms)
            _, ms = timed(lambda: verify_queries(session.session_id, expected))
            durations["cold_sql"].append(ms)
            _, ms = timed(lambda: verify_queries(session.session_id, expected))
            durations["warm_sql"].append(ms)
            counts.append(
                {"input_rows": table.num_rows, "arrow_bytes": table.nbytes, "complete": True}
            )
        finally:
            mgr.drop_session(session.session_id)

    def concurrent_query(_):
        # Independent sessions/connections: not simultaneous SQL on one DuckDB connection.
        session = mgr.get_or_create_session()
        try:
            session.register_dataset("facts", table)
            return verify_queries(session.session_id, expected)["count"]["data"][0]["rows"]
        finally:
            mgr.drop_session(session.session_id)

    def parallel():
        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(concurrent_query, range(2)))

    concurrent, concurrent_ms = timed(parallel)
    if concurrent != [expected["rows"]] * 2:
        raise AssertionError("Concurrent sessions returned inconsistent data")
    failure_checks = {}
    session = mgr.get_or_create_session()
    try:
        session.register_dataset("facts", table)
        for name, query in [
            ("write", "DELETE FROM facts"),
            ("external", "SELECT * FROM read_csv('/etc/passwd')"),
        ]:
            try:
                run_duckdb_sql(session.session_id, query)
            except PermissionError:
                failure_checks[name] = "blocked"
            else:
                raise AssertionError(f"Unsafe SQL executed: {name}")
    finally:
        mgr.drop_session(session.session_id)
    try:
        run_duckdb_sql("s0-missing-session", QUERIES["count"])
    except ValueError:
        failure_checks["missing_session"] = "blocked"
    else:
        raise AssertionError("Missing session returned success")
    # Real authenticated ASGI route, not a network/CGW timing benchmark.
    from fastapi.testclient import TestClient

    from data_analysis.main import app

    with TestClient(app) as client:
        upload, api_ms = timed(
            lambda: client.post(
                "/api/v1/import/file",
                headers={"X-API-Key": "s0-local-only-a"},
                files={
                    "file": (
                        "table.xlsx",
                        (fixture_dir / "table.xlsx").read_bytes(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                },
                data={"dataset_name": "facts"},
            )
        )
        upload.raise_for_status()
        body = upload.json()
        api_id = body["session_id"]
        try:
            if body["row_count"] != expected["rows"]:
                raise AssertionError("API returned a truncated dataset")
            denied = client.post(
                "/api/v1/tools/sql",
                headers={"X-API-Key": "s0-local-only-b"},
                json={"session_id": api_id, "sql_query": QUERIES["count"], "limit": 20},
            )
            if denied.status_code != 404:
                raise AssertionError(f"Other owner accessed session: {denied.status_code}")
            preview = client.post(
                "/api/v1/tools/sql",
                headers={"X-API-Key": "s0-local-only-a"},
                json={
                    "session_id": api_id,
                    "sql_query": "SELECT * FROM facts ORDER BY row_id",
                    "limit": 5,
                },
            )
            preview.raise_for_status()
            if len(preview.json()["data_preview"]) != 5:
                raise AssertionError("Preview limit not honored")
            api_results = {}
            for name, query in QUERIES.items():
                response = client.post(
                    "/api/v1/tools/sql",
                    headers={"X-API-Key": "s0-local-only-a"},
                    json={"session_id": api_id, "sql_query": query, "limit": 5000},
                )
                response.raise_for_status()
                api_results[name] = {"data": response.json()["data_preview"]}
            assert_query_results(api_results, expected)
        finally:
            cleaned = client.delete(
                f"/api/v1/sessions/{api_id}", headers={"X-API-Key": "s0-local-only-a"}
            )
            cleaned.raise_for_status()
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    if source_snapshot() != sources:
        raise RuntimeError("Source changed during the run; mixed-source baseline is not valid")
    read_fixture(fixture_dir)  # File modifications during the run invalidate the evidence too.
    report = {
        "baseline_version": 1,
        "kind": "local-diagnostic",
        "fixture": manifest,
        "fixture_directory": str(fixture_dir),
        "fixture_reused": bool(args.fixture_dir),
        "source_commit": subprocess.check_output(
            ["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True
        ).strip(),
        "source_dirty": bool(
            subprocess.check_output(
                ["git", "-C", str(ROOT), "status", "--porcelain"], text=True
            ).strip()
        ),
        "source_files_sha256": sources,
        "runtime": {
            "python": platform.python_version(),
            "platform": platform.platform(),
            "cpu_count": os.cpu_count(),
            "load_average_at_end": list(os.getloadavg()),
            "threads": args.threads,
            "duckdb_memory_limit": "512MB",
            "max_total_arrow_mb": 2048,
            "packages": {
                p: importlib.metadata.version(p) for p in ("duckdb", "pyarrow", "fastapi")
            },
        },
        "generation_ms": generation_ms,
        "phases": {k: distribution(v) for k, v in durations.items()},
        "process_peak_rss_bytes": peak if platform.system() == "Darwin" else peak * 1024,
        "peak_scope": "whole process, including generation/verification/API; not per-stage peak",
        "performance_scope": "local diagnostic; host load is uncontrolled, not an SLA or cross-project speed comparison",
        "model_calls": 0,
        "model_mode": "no-model deterministic parser/SQL baseline",
        "unmeasured_phases": ["network_download", "queue", "business_write", "real_model"],
        "api_upload_parse_ms": api_ms,
        "api_timing_scope": "in-process ASGI, not network/CGW",
        "dataset_observations": counts,
        "concurrency": {"independent_sessions": 2, "ms": concurrent_ms},
        "failure_checks": failure_checks,
        "api_owner_isolation": "different API keys isolated",
        "business_tenant_scope": "not provided by Insight; requires Host/Node integration in S1",
        "preview_rows": 5,
        "aggregate_uses_full_rows": expected["rows"],
        "verdict": "pass",
    }
    (out / "baseline.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(
        json.dumps(
            {
                "out": str(out),
                "verdict": report["verdict"],
                "rows": expected["rows"],
                "phases": report["phases"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
