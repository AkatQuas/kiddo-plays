"""Independent full-data expectations. No app/DuckDB/Arrow imports."""

import hashlib
import json
from collections import defaultdict
from decimal import Decimal

COLUMNS = (
    "row_id",
    "event_id",
    "line_no",
    "event_date",
    "party_code",
    "region",
    "item_code",
    "quantity",
    "unit_price",
    "amount",
    "cost_amount",
    "status",
)


def canonical_digest(values):
    payload = json.dumps(list(values), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class Expected:
    def __init__(self):
        self.rows = 0
        self.keys = set()
        self.annual = defaultdict(int)
        self.total = 0
        self.errors = {"duplicate_extra": [], "empty_party": [], "amount_mismatch": []}
        self.digest = hashlib.sha256()

    def add(self, values):
        row = dict(zip(COLUMNS, values, strict=True))
        self.rows += 1
        amount = Decimal(str(row["amount"]))
        minor = int(amount * 100)
        if amount != Decimal(minor) / 100:
            raise ValueError("Fixture amount must have integral cents")
        self.total += minor
        self.annual[str(row["event_date"])[:4]] += minor
        key = (row["event_id"], row["line_no"])
        issues = []
        if key in self.keys:
            issues.append("duplicate_extra")
        self.keys.add(key)
        if not str(row["party_code"]).strip():
            issues.append("empty_party")
        correct = Decimal(str(row["unit_price"])) * int(row["quantity"])
        if correct != amount:
            issues.append("amount_mismatch")
        for kind in issues:
            self.errors[kind].append(row["row_id"])
        fingerprint = canonical_digest(values)
        self.digest.update((fingerprint + "\n").encode())
        return {
            "row_id": row["row_id"],
            "excel_row": self.rows + 1,
            "values_sha256": fingerprint,
            "issues": issues,
            "computed_amount_minor": int(correct * 100),
        }

    def summary(self):
        return {
            "rows": self.rows,
            "columns": len(COLUMNS),
            "amount_minor": self.total,
            "annual_amount_minor": dict(sorted(self.annual.items())),
            "quality": {
                key: {"count": len(ids), "row_ids": ids} for key, ids in self.errors.items()
            },
            "logical_sha256": self.digest.hexdigest(),
            "amount_semantics": "sum of all raw amounts, including duplicate/invalid rows; cents",
        }
