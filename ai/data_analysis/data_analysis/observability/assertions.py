import time
from typing import Any

import duckdb

from data_analysis.engine.sql_guard import safe_ident, safe_table_ref


class DataQualityAssertions:
    @staticmethod
    def expect_column_values_to_not_be_null(
        con: duckdb.DuckDBPyConnection, table: str, column: str
    ) -> dict[str, Any]:
        table = safe_table_ref(table)
        col = safe_ident(column)
        total = con.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        nulls = con.execute(f"SELECT count(*) FROM {table} WHERE {col} IS NULL").fetchone()[0]
        passed = nulls == 0
        return {
            "assertion": "expect_column_values_to_not_be_null",
            "column": column,
            "passed": passed,
            "total_records": total,
            "unexpected_count": nulls,
            "unexpected_percent": round((nulls / total * 100.0), 2) if total > 0 else 0.0,
        }

    @staticmethod
    def expect_column_values_to_be_unique(
        con: duckdb.DuckDBPyConnection, table: str, column: str
    ) -> dict[str, Any]:
        table = safe_table_ref(table)
        col = safe_ident(column)
        total = con.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        distinct = con.execute(f"SELECT count(DISTINCT {col}) FROM {table}").fetchone()[0]
        duplicates = total - distinct
        passed = duplicates == 0
        return {
            "assertion": "expect_column_values_to_be_unique",
            "column": column,
            "passed": passed,
            "total_records": total,
            "unexpected_count": duplicates,
            "unexpected_percent": round((duplicates / total * 100.0), 2) if total > 0 else 0.0,
        }

    @staticmethod
    def expect_column_values_to_be_between(
        con: duckdb.DuckDBPyConnection, table: str, column: str, min_val: float, max_val: float
    ) -> dict[str, Any]:
        table = safe_table_ref(table)
        col = safe_ident(column)
        total = con.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
        out_of_bounds = con.execute(
            f"SELECT count(*) FROM {table} WHERE {col} < ? OR {col} > ?", [min_val, max_val]
        ).fetchone()[0]
        passed = out_of_bounds == 0
        return {
            "assertion": "expect_column_values_to_be_between",
            "column": column,
            "min_val": min_val,
            "max_val": max_val,
            "passed": passed,
            "total_records": total,
            "unexpected_count": out_of_bounds,
            "unexpected_percent": round((out_of_bounds / total * 100.0), 2) if total > 0 else 0.0,
        }

    @staticmethod
    def expect_table_row_count_to_be_between(
        con: duckdb.DuckDBPyConnection, table: str, min_rows: int, max_rows: int
    ) -> dict[str, Any]:
        total = con.execute(f"SELECT count(*) FROM {safe_table_ref(table)}").fetchone()[0]
        passed = min_rows <= total <= max_rows
        return {
            "assertion": "expect_table_row_count_to_be_between",
            "min_rows": min_rows,
            "max_rows": max_rows,
            "actual_rows": total,
            "passed": passed,
        }

    @classmethod
    def run_suite(
        cls, con: duckdb.DuckDBPyConnection, table: str, rules: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """
        Production Consolidated Single-Pass Aggregation Execution:
        Compiles multiple rule metrics into a single SQL scan to optimize IO throughput.
        """
        if not rules:
            return {
                "table_name": table,
                "total_assertions": 0,
                "passed_assertions": 0,
                "data_health_score": 100.0,
                "assertion_results": [],
            }

        start_t = time.time()

        supported_types = {"not_null", "unique", "between", "row_count"}
        supported = []
        early_results = []
        for r in rules:
            if r.get("type") not in supported_types:
                early_results.append(
                    {
                        "assertion": "unsupported_rule",
                        "rule_type": r.get("type"),
                        "passed": False,
                    }
                )
            else:
                supported.append(r)
        rules = supported
        if not rules:
            total_rules = len(early_results)
            return {
                "table_name": table,
                "total_assertions": total_rules,
                "passed_assertions": 0,
                "failed_assertions": total_rules,
                "data_health_score": 0.0 if total_rules else 100.0,
                "all_passed": total_rules == 0,
                "scan_duration_ms": round((time.time() - start_t) * 1000, 2),
                "assertion_results": early_results,
            }

        # Build consolidated SELECT list
        agg_clauses = ["count(*) AS _total_count"]
        clause_map = []
        params = []

        for idx, r in enumerate(rules):
            rtype = r.get("type")
            alias = f"_metric_{idx}"

            if rtype == "not_null":
                col = safe_ident(r["column"])
                agg_clauses.append(f"count(CASE WHEN {col} IS NULL THEN 1 END) AS {alias}")
                clause_map.append((idx, r, "not_null"))
            elif rtype == "unique":
                col = safe_ident(r["column"])
                agg_clauses.append(f"count(DISTINCT {col}) AS {alias}")
                clause_map.append((idx, r, "unique"))
            elif rtype == "between":
                col = safe_ident(r["column"])
                agg_clauses.append(f"count(CASE WHEN {col} < ? OR {col} > ? THEN 1 END) AS {alias}")
                params.extend([r["min_val"], r["max_val"]])
                clause_map.append((idx, r, "between"))
            elif rtype == "row_count":
                # uses _total_count
                clause_map.append((idx, r, "row_count"))

        consolidated_sql = f"SELECT {', '.join(agg_clauses)} FROM {safe_table_ref(table)}"
        row = con.execute(consolidated_sql, params).fetchone()
        cols = [d[0] for d in con.description]
        metrics_dict = dict(zip(cols, row, strict=False))

        total_rows = metrics_dict.get("_total_count", 0) if rules else 0
        results = list(early_results)
        passed_count = 0

        for idx, r, rtype in clause_map:
            alias = f"_metric_{idx}"
            val = metrics_dict.get(alias, 0)

            if rtype == "not_null":
                passed = val == 0
                unexpected = val
                results.append(
                    {
                        "assertion": "expect_column_values_to_not_be_null",
                        "column": r["column"],
                        "passed": passed,
                        "total_records": total_rows,
                        "unexpected_count": unexpected,
                        "unexpected_percent": round((unexpected / total_rows * 100.0), 2)
                        if total_rows > 0
                        else 0.0,
                    }
                )
            elif rtype == "unique":
                duplicates = total_rows - val
                passed = duplicates == 0
                results.append(
                    {
                        "assertion": "expect_column_values_to_be_unique",
                        "column": r["column"],
                        "passed": passed,
                        "total_records": total_rows,
                        "unexpected_count": duplicates,
                        "unexpected_percent": round((duplicates / total_rows * 100.0), 2)
                        if total_rows > 0
                        else 0.0,
                    }
                )
            elif rtype == "between":
                passed = val == 0
                results.append(
                    {
                        "assertion": "expect_column_values_to_be_between",
                        "column": r["column"],
                        "min_val": r["min_val"],
                        "max_val": r["max_val"],
                        "passed": passed,
                        "total_records": total_rows,
                        "unexpected_count": val,
                        "unexpected_percent": round((val / total_rows * 100.0), 2)
                        if total_rows > 0
                        else 0.0,
                    }
                )
            elif rtype == "row_count":
                passed = r["min_rows"] <= total_rows <= r["max_rows"]
                results.append(
                    {
                        "assertion": "expect_table_row_count_to_be_between",
                        "min_rows": r["min_rows"],
                        "max_rows": r["max_rows"],
                        "actual_rows": total_rows,
                        "passed": passed,
                    }
                )

            if passed:
                passed_count += 1

        total_rules = len(results)
        health_score = round((passed_count / total_rules * 100.0), 1) if total_rules > 0 else 100.0
        duration_ms = round((time.time() - start_t) * 1000, 2)

        return {
            "table_name": table,
            "total_assertions": total_rules,
            "passed_assertions": passed_count,
            "failed_assertions": total_rules - passed_count,
            "data_health_score": health_score,
            "all_passed": (passed_count == total_rules),
            "scan_duration_ms": duration_ms,
            "assertion_results": results,
        }
