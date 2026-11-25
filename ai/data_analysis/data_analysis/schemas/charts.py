from typing import Any


class ChartSpecBuilder:
    """Programmatic generator of declarative Vega-Lite and ECharts JSON specifications."""

    @staticmethod
    def build_waterfall_chart(
        data: list[dict[str, Any]],
        category_field: str,
        value_field: str,
        title: str = "Driver Attribution Waterfall",
    ) -> dict[str, Any]:
        running = 0.0
        enriched = []
        for row in data:
            delta = float(row.get(value_field) or 0)
            start = running
            running += delta
            enriched.append({**row, "start": start, "end": running})
        return {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "title": title,
            "data": {"values": enriched},
            "mark": {"type": "bar", "tooltip": True},
            "encoding": {
                "x": {"field": category_field, "type": "nominal", "sort": None},
                "y": {"field": "start", "type": "quantitative"},
                "y2": {"field": "end", "type": "quantitative"},
                "color": {
                    "condition": {"test": f"datum.{value_field} > 0", "value": "#2ca02c"},
                    "value": "#d62728",
                },
            },
        }

    @staticmethod
    def build_scatter_regression_chart(
        data: list[dict[str, Any]],
        x_field: str,
        y_field: str,
        title: str = "Scatter Regression Fit",
    ) -> dict[str, Any]:
        return {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "title": title,
            "layer": [
                {
                    "data": {"values": data},
                    "mark": "point",
                    "encoding": {
                        "x": {"field": x_field, "type": "quantitative"},
                        "y": {"field": y_field, "type": "quantitative"},
                    },
                },
                {
                    "data": {"values": data},
                    "mark": {"type": "line", "color": "firebrick"},
                    "transform": [{"regression": y_field, "on": x_field}],
                    "encoding": {
                        "x": {"field": x_field, "type": "quantitative"},
                        "y": {"field": y_field, "type": "quantitative"},
                    },
                },
            ],
        }

    @staticmethod
    def build_time_series_forecast_chart(
        historical: list[dict[str, Any]],
        forecasts: list[dict[str, Any]],
        time_field: str,
        value_field: str,
    ) -> dict[str, Any]:
        combined_data = [
            {"time": h["time"], "val": h["value"], "type": "Historical"} for h in historical
        ] + [
            {
                "time": f"T+{f['step']}",
                "val": f["predicted_value"],
                "type": "Forecast",
                "lower": f["ci_95_lower"],
                "upper": f["ci_95_upper"],
            }
            for f in forecasts
        ]
        return {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "title": "Time Series Forecast with 95% Confidence Interval",
            "data": {"values": combined_data},
            "layer": [
                {
                    "data": {"values": [r for r in combined_data if r["type"] == "Forecast"]},
                    "mark": {"type": "errorband", "extent": "ci"},
                    "encoding": {
                        "x": {"field": "time", "type": "ordinal"},
                        "y": {"field": "lower", "type": "quantitative"},
                        "y2": {"field": "upper"},
                    },
                },
                {
                    "data": {"values": combined_data},
                    "mark": "line",
                    "encoding": {
                        "x": {"field": "time", "type": "ordinal"},
                        "y": {"field": "val", "type": "quantitative"},
                        "color": {"field": "type", "type": "nominal"},
                    },
                },
            ],
        }

    @staticmethod
    def build_sankey_chart(
        nodes: list[dict[str, Any]],
        links: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return {
            "series": [
                {
                    "type": "sankey",
                    "data": nodes,
                    "links": links,
                }
            ]
        }

    @staticmethod
    def build_retention_heatmap(matrix: list[dict[str, Any]]) -> dict[str, Any]:
        values = []
        for row in matrix:
            cohort = row.get("cohort_date")
            for key, cell in row.items():
                if not key.startswith("day_"):
                    continue
                day = int(key.split("_", 1)[1])
                rate = cell.get("rate") if isinstance(cell, dict) else cell
                values.append({"cohort": cohort, "day": day, "rate": rate})
        return {
            "mark": "rect",
            "data": {"values": values},
            "encoding": {
                "x": {"field": "day", "type": "ordinal"},
                "y": {"field": "cohort", "type": "nominal"},
                "color": {"field": "rate", "type": "quantitative"},
            },
        }

    @staticmethod
    def build_funnel_chart(steps: list[dict[str, Any]]) -> dict[str, Any]:
        return {
            "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
            "data": {
                "values": [
                    {"step": s.get("step_name"), "users": s.get("user_count")} for s in steps
                ]
            },
        }
