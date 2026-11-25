"""Built-in ERP example: in-memory sample + end-to-end pipeline + report.

Single source of truth for the ERP demo, used by both the web endpoint
(/api/v1/examples/erp/run) and the CLI example (examples/erp-analysis). Generates
a seeded Order-to-Cash dataset, lands it in an analytical session, drives the
service operators + Insight Copilot, and returns a structured result including a
Markdown report.
"""

import random
from typing import Any, Dict

import pandas as pd

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.operators.eda import run_eda_profile
from data_analysis.operators.olap import run_olap_query
from data_analysis.operators.correlation import run_correlation_analysis
from data_analysis.operators.spss.hypothesis import run_spss_hypothesis_test
from data_analysis.operators.mining.clustering import run_rfm_segmentation
from data_analysis.distributed_ops.dist_driver import DistributedDriverAnalysis
from data_analysis.observability.assertions import DataQualityAssertions
from data_analysis.copilot import discover_insights
from data_analysis.nlg.narrative_builder import NarrativeBuilder

EXAMPLE_ID = "o2c"
NAME = "Order-to-Cash (synthetic)"
DOMAIN = "Enterprise · Order-to-Cash"
DESCRIPTION = "Synthetic O2C: EDA, OLAP, quality, correlation, ANOVA, RFM, drivers, Insight Copilot"
FACT = "o2c_sales"
TABLES = ("customers", "products", "sales_orders", "sales_order_lines")

_REGIONS = ["East", "West", "North", "South"]
_CATEGORIES = ["Furniture", "Technology", "Office Supplies"]
_SEGMENTS = ["Consumer", "Corporate", "Home Office"]
_INDUSTRIES = ["Retail", "Manufacturing", "Healthcare", "Finance", "Education"]
_CHANNELS = ["Online", "Partner", "Direct"]


def generate_frames(seed: int = 42, n_orders: int = 1000) -> Dict[str, pd.DataFrame]:
    """Deterministic in-memory ERP sample (schema mirrors Kaggle ERP datasets)."""
    from datetime import date, timedelta
    rng = random.Random(seed)

    customers = [{
        "customer_id": f"C{i:04d}", "name": f"Customer {i}",
        "industry": rng.choice(_INDUSTRIES), "segment": rng.choice(_SEGMENTS),
        "region": rng.choice(_REGIONS),
    } for i in range(1, 151)]

    products = []
    for i in range(1, 51):
        cat = rng.choice(_CATEGORIES)
        cost = round(rng.uniform(20, 400), 2)
        margin = {"Furniture": 1.35, "Technology": 1.55, "Office Supplies": 1.25}[cat]
        products.append({"product_id": f"P{i:04d}", "name": f"{cat[:4]}-{i}",
                         "category": cat, "unit_cost": cost, "unit_price": round(cost * margin, 2)})

    start = date(2024, 1, 1)
    orders, lines = [], []
    lid = 1
    for oid in range(1, n_orders + 1):
        cust = rng.choice(customers)
        odate = start + timedelta(days=rng.randint(0, 729))
        region = cust["region"]
        orders.append({"order_id": f"SO{oid:05d}", "customer_id": cust["customer_id"],
                       "order_date": odate.isoformat(), "channel": rng.choice(_CHANNELS),
                       "status": rng.choices(["Completed", "Cancelled"], weights=[0.93, 0.07])[0],
                       "region": region})
        for _ in range(rng.randint(1, 4)):
            p = rng.choice(products)
            qty = rng.randint(1, 12)
            disc = rng.uniform(0, 0.15)
            # Signal: West+Technology margin erosion in 2025 for the driver/insight to find.
            if region == "West" and p["category"] == "Technology" and odate.year == 2025:
                disc += rng.uniform(0.15, 0.30)
            disc = round(min(disc, 0.5), 3)
            line_total = round(qty * p["unit_price"] * (1 - disc), 2)
            cogs = round(qty * p["unit_cost"], 2)
            lines.append({"line_id": f"L{lid:06d}", "order_id": f"SO{oid:05d}",
                          "product_id": p["product_id"], "quantity": qty,
                          "unit_price": p["unit_price"], "discount": disc,
                          "line_total": line_total, "cogs": cogs,
                          "profit": round(line_total - cogs, 2)})
            lid += 1
    for _ in range(6):  # a few outliers for anomaly detection
        ln = rng.choice(lines)
        ln["line_total"] = round(ln["line_total"] * rng.uniform(15, 30), 2)
        ln["profit"] = round(ln["line_total"] - ln["cogs"], 2)

    return {"customers": pd.DataFrame(customers), "products": pd.DataFrame(products),
            "sales_orders": pd.DataFrame(orders), "sales_order_lines": pd.DataFrame(lines)}


def register_frames(con, frames: Dict[str, pd.DataFrame]):
    for name in TABLES:
        df = frames[name]
        con.register(f"_src_{name}", df)
        con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM _src_{name}")
        con.unregister(f"_src_{name}")


def build_fact(con):
    con.execute(f"""
        CREATE OR REPLACE TABLE {FACT} AS
        SELECT l.line_id, o.order_id, o.order_date, o.region, o.channel,
               c.customer_id, c.segment, c.industry,
               p.product_id, p.category,
               l.quantity, l.unit_price, l.discount,
               l.line_total AS sales, l.cogs, l.profit
        FROM sales_order_lines l
        JOIN sales_orders o ON l.order_id = o.order_id
        JOIN customers c ON o.customer_id = c.customer_id
        JOIN products p ON l.product_id = p.product_id
        WHERE o.status = 'Completed'
    """)


def analyze(session_id: str, con) -> Dict[str, Any]:
    total_rows = con.execute(f"SELECT count(*) FROM {FACT}").fetchone()[0]
    eda = run_eda_profile(session_id, FACT)
    olap = run_olap_query(session_id, FACT, dimensions=["region", "category"],
                          metrics=["sales", "profit"], agg_funcs=["sum", "sum"], limit=50)
    quality = DataQualityAssertions.run_suite(con, FACT, rules=[
        {"type": "not_null", "column": "order_id"},
        {"type": "not_null", "column": "profit"},
        {"type": "between", "column": "discount", "min_val": 0, "max_val": 1},
        {"type": "row_count", "min_rows": 1, "max_rows": 10_000_000},
    ])
    corr = run_correlation_analysis(session_id, FACT, columns=["quantity", "discount", "sales", "profit"])
    anova = run_spss_hypothesis_test(session_id, FACT, test_type="one_way_anova",
                                     dependent_var="profit", group_var="region")
    rfm = run_rfm_segmentation(session_id, FACT, user_col="customer_id",
                               date_col="order_date", amount_col="sales")
    driver = DistributedDriverAnalysis.analyze_driver(
        con=con, table_name=FACT, target_metric="profit", dimension_path=["region", "category"],
        base_filter="order_date < '2025-01-01'", current_filter="order_date >= '2025-01-01'",
        agg_func="SUM", top_k=5)
    insights = discover_insights(session_id, FACT, target_metric="profit",
                                 category_col="region", time_col="order_date")

    report = _report(total_rows, eda, olap, quality, corr, anova, rfm, driver, insights)
    return {"example_id": EXAMPLE_ID, "name": NAME, "domain": DOMAIN,
            "session_id": session_id, "dataset_name": FACT, "rows": total_rows,
            "insights": insights, "report_markdown": report}


def run_in_memory(session_id: str = None, seed: int = 42) -> Dict[str, Any]:
    sess = SessionManager().get_or_create_session(session_id)
    con = sess.get_duckdb_conn()
    register_frames(con, generate_frames(seed))
    build_fact(con)
    return analyze(sess.session_id, con)


def _f(n):
    try:
        return f"{float(n):,.2f}"
    except (TypeError, ValueError):
        return str(n)


def _report(rows, eda, olap, quality, corr, anova, rfm, driver, insights) -> str:
    L = [
        "# Order-to-Cash report\n",
        "> Generated end-to-end (EDA, OLAP, quality, correlation, ANOVA, RFM, drivers, Insight Copilot).\n",
    ]
    L.append("## 1. Overview and quality")
    L.append(f"- Completed order lines: **{rows:,}**")
    L.append(
        f"- Data health: **{quality.get('data_health_score')}/100** "
        f"({quality.get('passed_assertions')}/{quality.get('total_assertions')} assertions passed)"
    )
    L.append(f"- EDA: {NarrativeBuilder.generate_eda_narrative(eda)}\n")
    L.append("## 2. Region x category OLAP")
    recs = olap.get("records", [])[:10]
    if recs:
        cols = list(recs[0].keys())
        L.append("| " + " | ".join(cols) + " |")
        L.append("|" + "|".join(["---"] * len(cols)) + "|")
        for r in recs:
            L.append("| " + " | ".join(_f(r[c]) for c in cols) + " |")
    L.append("")
    L.append("## 3. Correlations")
    for p in corr.get("high_correlation_pairs", []) or [
        {"col1": "-", "col2": "-", "r": "-", "strength": "none"}
    ]:
        L.append(f"- **{p['col1']} vs {p['col2']}**: r={p['r']} ({p['strength']})")
    L.append("")
    L.append("## 4. One-way ANOVA on profit by region")
    L.append(f"- {NarrativeBuilder.generate_spss_narrative(anova)}\n")
    L.append("## 5. RFM segments")
    segs = rfm.get("segment_distribution") or rfm.get("segments") or {}
    if isinstance(segs, dict) and segs:
        for k, v in list(segs.items())[:8]:
            L.append(f"- {k}: {v}")
    else:
        L.append(f"- RFM customers covered: {rfm.get('total_customers', 'N/A')}")
    L.append("")
    L.append("## 6. Driver attribution (2024 to 2025)")
    for b in (driver.get("hierarchy") or [{}])[0].get("branches", [])[:5]:
        L.append(f"- {b.get('dimension_value')}: diff {_f(b.get('diff_value'))}")
    L.append(f"- Narrative: {NarrativeBuilder.generate_driver_narrative(driver)}\n")
    L.append("## 7. Insight Copilot")
    nar = insights.get("narrative", {})
    L.append(f"**{nar.get('headline','')}**\n")
    for s in nar.get("sections", []):
        L.append(f"- {s}")
    g = insights.get("insight_graph", {})
    L.append(f"\n- Insight graph: {len(g.get('nodes', []))} nodes, {len(g.get('edges', []))} edges")
    if nar.get("recommendation"):
        L.append(f"- **Recommendation**: {nar['recommendation']}")
    return "\n".join(L) + "\n"
