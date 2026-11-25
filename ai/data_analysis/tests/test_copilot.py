import pyarrow as pa

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.copilot import discover_insights


def _make_session():
    # region is skewed (concentration), sales~profit correlated, one clear outlier.
    regions, sales, profit = [], [], []
    for i in range(40):
        r = ["East", "East", "East", "West", "North"][i % 5]
        base = 100 + (200 if r == "East" else 0) + (i % 7)
        regions.append(r)
        sales.append(float(base))
        profit.append(float(base * 0.3))
    regions.append("East")
    sales.append(9999.0)
    profit.append(3000.0)  # outlier
    tbl = pa.table({"region": regions, "sales": sales, "profit": profit})
    sess = SessionManager().get_or_create_session("copilot_test")
    sess.register_dataset("biz", tbl)
    return "copilot_test"


def test_discover_insights_produces_report():
    sid = _make_session()
    rep = discover_insights(sid, "biz", category_col="region")
    assert rep["total_insights"] > 0
    # An Insight Graph is produced with one node per insight.
    assert len(rep["insight_graph"]["nodes"]) == len(rep["insights"])
    # Every insight is well-formed.
    for i in rep["insights"]:
        assert i["id"] and i["type"] in {"anomaly", "correlation", "dominance", "trend"}
        assert 0.0 <= i["severity"] <= 1.0
        assert i["statement"]
    # A coherent data story is composed.
    assert rep["narrative"]["headline"]
    assert rep["narrative"]["sections"]


def test_discover_insights_finds_correlation_and_dominance():
    sid = _make_session()
    rep = discover_insights(sid, "biz", category_col="region")
    types = {i["type"] for i in rep["insights"]}
    assert "correlation" in types  # sales ~ profit are strongly correlated
    assert "dominance" in types  # East dominates


def test_intent_biases_actions():
    sid = _make_session()
    rep = discover_insights(sid, "biz", intent="只看相关性", category_col="region")
    assert rep["actions_run"] == ["correlation"]
    assert all(i["type"] == "correlation" for i in rep["insights"])
