from enum import Enum
from typing import Any

import pyarrow as pa


class SemanticType(str, Enum):
    MEASURE = "MEASURE"  # Continuous numeric values (sales, temperature, duration)
    DIMENSION_CATEGORICAL = "DIMENSION_CATEGORICAL"  # Low/Medium cardinality discrete categories (city, status, channel)
    DIMENSION_TEMPORAL = "DIMENSION_TEMPORAL"  # Dates, timestamps (created_at, order_date)
    IDENTIFIER = "IDENTIFIER"  # Primary/Foreign keys, high cardinality IDs (order_id, user_uuid)
    TEXT = "TEXT"  # Long unstructured text


class SchemaInferencer:
    """Infers rich semantic roles from physical column types and sample distribution statistics."""

    @staticmethod
    def infer_column_semantic_type(
        col_name: str, pa_type: pa.DataType, cardinality: int, total_rows: int
    ) -> SemanticType:
        type_str = str(pa_type).lower()
        name_lower = col_name.lower()

        # 1. Check ID indicators. Match a suffix or an exact name.
        # "paid" and "valid" end with the letters id and are measures, not keys.
        if name_lower.endswith("_id") or name_lower in {"id", "uuid", "code", "guid", "pk"}:
            return SemanticType.IDENTIFIER

        # 2. Check temporal types
        if (
            "date" in type_str
            or "timestamp" in type_str
            or "time" in type_str
            or name_lower in ["date", "created_at", "updated_at", "time", "dt"]
        ):
            return SemanticType.DIMENSION_TEMPORAL

        # 3. Check numeric / measure types
        if any(
            num_t in type_str for num_t in ["int", "float", "double", "decimal"]
        ) and not name_lower.endswith("_id"):
            # Check cardinality ratio
            cardinality_ratio = cardinality / max(1, total_rows)
            if cardinality <= 10 and total_rows > 50:
                return SemanticType.DIMENSION_CATEGORICAL
            return SemanticType.MEASURE

        # 4. Check strings / text
        if "string" in type_str or "str" in type_str or "varchar" in type_str or "text" in type_str:
            cardinality_ratio = cardinality / max(1, total_rows)
            if cardinality_ratio > 0.8 and total_rows > 100:
                return SemanticType.IDENTIFIER
            if cardinality <= 1000 or cardinality_ratio < 0.2:
                return SemanticType.DIMENSION_CATEGORICAL
            return SemanticType.TEXT

        # Default fallback
        return SemanticType.DIMENSION_CATEGORICAL

    @classmethod
    def infer_table_schema(cls, table: Any) -> dict[str, dict[str, Any]]:
        if isinstance(table, pa.RecordBatchReader):
            table = table.read_all()
        total_rows = len(table)
        schema_map = {}
        for col_name in table.column_names:
            col_data = table[col_name]
            pa_type = col_data.type
            # Fast distinct count on sample
            try:
                distinct_cnt = len(pa.compute.unique(col_data.slice(0, min(10000, total_rows))))
            except Exception:
                distinct_cnt = total_rows

            semantic_t = cls.infer_column_semantic_type(col_name, pa_type, distinct_cnt, total_rows)
            schema_map[col_name] = {
                "physical_type": str(pa_type),
                "semantic_type": semantic_t.value,
                "null_count": col_data.null_count,
                "null_percentage": round((col_data.null_count / max(1, total_rows)) * 100, 2),
            }
        return schema_map
