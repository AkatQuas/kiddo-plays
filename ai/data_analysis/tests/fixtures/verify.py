"""S0: full-data checks using existing parser and SQL sandbox; no production changes."""

import hashlib
import json
from pathlib import Path

from tests.fixtures.expected.checks import COLUMNS, canonical_digest
from tests.fixtures.generators.table_fixture import file_digest

QUERIES = {
    "count": "SELECT count(*) AS rows FROM facts",
    "annual": """SELECT substr(CAST(event_date AS VARCHAR), 1, 4) AS year,
        CAST(sum(CAST(amount AS DECIMAL(20,2))) * 100 AS BIGINT) AS amount_minor
        FROM facts GROUP BY 1 ORDER BY 1""",
    "total": "SELECT CAST(sum(CAST(amount AS DECIMAL(20,2))) * 100 AS BIGINT) AS amount_minor FROM facts",
    "duplicate_extra": """SELECT row_id FROM
        (SELECT row_id, row_number() OVER (PARTITION BY event_id,line_no ORDER BY row_id) AS n FROM facts)
        WHERE n > 1 ORDER BY row_id""",
    "empty_party": "SELECT row_id FROM facts WHERE party_code IS NULL OR trim(party_code) = '' ORDER BY row_id",
    "amount_mismatch": """SELECT row_id FROM facts WHERE CAST(amount AS DECIMAL(20,2))
        <> CAST(unit_price AS DECIMAL(20,2)) * quantity ORDER BY row_id""",
}


def read_fixture(directory):
    directory = Path(directory)
    manifest = json.loads((directory / "manifest.json").read_text())
    if manifest["manifest_version"] != 1 or manifest["suite_id"] != "generic-table-quality@1":
        raise ValueError("Unsupported fixture manifest")
    if set(manifest["files"]) != {"table.xlsx", "expected.json", "expected-rows.jsonl"}:
        raise ValueError("Missing required fixture files")
    for name, meta in manifest["files"].items():
        if Path(name).name != name:
            raise ValueError("Manifest filename must be local")
        path = directory / name
        if path.stat().st_size != meta["bytes"] or file_digest(path) != meta["sha256"]:
            raise ValueError(f"Fixture changed: {name}")
    expected = json.loads((directory / "expected.json").read_text())
    if not manifest["full_dataset"] or expected["rows"] != manifest["artifact_rows"]:
        raise ValueError("Incomplete fixture manifest")
    return manifest, expected


def verify_full_rows(table, directory, expected):
    """Validate every parsed value against the independently written row fingerprints."""
    from decimal import Decimal

    if table.column_names != list(COLUMNS) or table.num_rows != expected["rows"]:
        raise AssertionError("Parser returned wrong columns or incomplete rows")
    digest = hashlib.sha256()
    with (Path(directory) / "expected-rows.jsonl").open() as source:
        count = 0
        for batch in table.to_batches(max_chunksize=4096):
            data = batch.to_pydict()
            for values in zip(*(data[k] for k in COLUMNS), strict=True):
                normalized = []
                for i, value in enumerate(values):
                    if i in (0, 2, 7):
                        normalized.append(int(value))
                    elif i in (8, 9, 10):
                        normalized.append(format(Decimal(str(value)), ".2f"))
                    else:
                        normalized.append("" if value is None else str(value))
                line = source.readline()
                if not line:
                    raise AssertionError("Expected row evidence ended early")
                evidence = json.loads(line)
                fingerprint = canonical_digest(normalized)
                if fingerprint != evidence["values_sha256"] or normalized[0] != evidence["row_id"]:
                    raise AssertionError(f"Parsed content differs at input row {count + 1}")
                digest.update((fingerprint + "\n").encode())
                count += 1
        if source.readline():
            raise AssertionError("Parser dropped rows")
    if count != expected["rows"] or digest.hexdigest() != expected["logical_sha256"]:
        raise AssertionError("Full logical checksum mismatch")


def verify_queries(session_id, expected):
    from data_analysis.operators.sandbox import run_duckdb_sql

    results = {
        name: run_duckdb_sql(session_id, query, limit=5000) for name, query in QUERIES.items()
    }
    assert_query_results(results, expected)
    return results


def assert_query_results(results, expected):
    if results["count"]["data"][0]["rows"] != expected["rows"]:
        raise AssertionError("SQL row count differs")
    if results["total"]["data"][0]["amount_minor"] != expected["amount_minor"]:
        raise AssertionError("SQL amount differs")
    annual = {row["year"]: row["amount_minor"] for row in results["annual"]["data"]}
    if annual != expected["annual_amount_minor"]:
        raise AssertionError("Annual amounts differ")
    for kind, reference in expected["quality"].items():
        ids = [int(row["row_id"]) for row in results[kind]["data"]]
        if ids != reference["row_ids"]:
            raise AssertionError(f"Quality row identities differ: {kind}")
