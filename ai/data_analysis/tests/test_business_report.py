import pytest
from pydantic import ValidationError

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.operators.business_report import discover_report, generate_business_report
from data_analysis.schemas.requests import BusinessReportRequest
from data_analysis.schemas.responses import BusinessReportResponse


@pytest.fixture
def sample():
    s = SessionManager().get_or_create_session()
    s.get_duckdb_conn().execute("""CREATE TABLE custom_sales("日期" VARCHAR,"区域" VARCHAR,"商品" VARCHAR,"订单号" VARCHAR,
      "数量" DOUBLE,"单价" DOUBLE,"折扣率" DOUBLE,"销售额" DOUBLE,"成本" DOUBLE,"利润" DOUBLE)""")
    s.get_duckdb_conn().executemany(
        "INSERT INTO custom_sales VALUES (?,?,?,?,?,?,?,?,?,?)",
        [
            ("2022-01-10", "华东", "A", "one", 10, 10, 0, 100, 40, 60),
            ("2023-01-10", "华东", "A", "two", 20, 10, 20, 160, 80, 80),
            ("2022-01-20", "O'Reilly", "B", "three", 5, 20, 0, 100, 50, 50),
            ("2023-01-20", "O'Reilly", "B", "four", 5, 20, 0, 100, 50, 50),
        ],
    )
    yield s
    SessionManager().drop_session(s.session_id)


def test_non_identifier_table_names_are_described():
    s = SessionManager().get_or_create_session()
    try:
        con = s.get_duckdb_conn()
        con.execute('CREATE TABLE "erp-sales" (d DATE, v DOUBLE)')
        con.execute("INSERT INTO \"erp-sales\" VALUES (DATE '2024-01-15', 1)")
        con.execute('CREATE TABLE "销售明细" (d DATE, v DOUBLE)')
        con.execute("INSERT INTO \"销售明细\" VALUES (DATE '2024-02-15', 2)")
        hyphen = discover_report(s.session_id, "erp-sales", "month")
        chinese = discover_report(s.session_id, "销售明细", "month")
        assert {c["column_name"] for c in hyphen["columns"]} == {"d", "v"}
        assert {c["column_name"] for c in chinese["columns"]} == {"d", "v"}
    finally:
        SessionManager().drop_session(s.session_id)


def request(s, **kw):
    body = dict(
        session_id=s.session_id,
        dataset_name="custom_sales",
        metric="利润",
        time_column="日期",
        dimensions=["区域"],
        base_start="2022-01-01",
        base_end="2022-02-01",
        current_start="2023-01-01",
        current_end="2023-02-01",
        mapping=dict(
            product="商品",
            quantity="数量",
            price="单价",
            discount="折扣率",
            discount_scale=100,
            sales="销售额",
            cost="成本",
            order="订单号",
        ),
    )
    body.update(kw)
    return BusinessReportRequest(**body)


def test_non_erp_chinese_mapping_closure_and_narrative(sample):
    r = generate_business_report(request(sample))
    BusinessReportResponse(**r)
    assert r["statistics"]["delta"] == 20
    assert "变化 +20.00" in r["summary"]
    bridge = r["profit_bridge"][0]
    assert abs(bridge["reconciliation_error"]) < 1e-8
    assert bridge["discount_effect"] < 0
    assert len(r["series"]) == 13
    assert r["series"][1]["value"] is None
    assert r["series"][-1]["yoy_delta"] == 20


def test_missing_mapping_still_produces_report(sample):
    r = generate_business_report(request(sample, mapping={}))
    assert r["series"] and r["dimensions"]
    assert r["profit_bridge"] == [] and "缺少字段映射" in r["skipped"][0]


def test_invalid_profit_identity_skips_bridge(sample):
    r = generate_business_report(request(sample, metric="销售额"))
    assert not r["profit_bridge"]
    assert any("不等于销售额" in s for s in r["checks"])


def test_cumulative_filters_and_quote_values(sample):
    r = generate_business_report(request(sample, filters={"区域": "O'Reilly", "商品": "B"}))
    assert r["statistics"]["base_value"] == 50
    assert r["statistics"]["delta"] == 0
    with pytest.raises(ValueError):
        generate_business_report(request(sample, filters={"区域": "x' OR TRUE --"}))


def test_schema_injection_rejected(sample):
    with pytest.raises(ValueError, match="字段不存在"):
        generate_business_report(request(sample, metric='利润"; DROP TABLE custom_sales; --'))
    assert discover_report(sample.session_id, "custom_sales")["suggestions"]["metric"] == "利润"


def test_missing_session_isolated(sample):
    other = SessionManager().get_or_create_session()
    try:
        with pytest.raises(ValueError):
            discover_report(other.session_id, "custom_sales")
    finally:
        SessionManager().drop_session(other.session_id)


def test_invalid_dates_and_nonfinite_are_counted(sample):
    sample.get_duckdb_conn().execute(
        "INSERT INTO custom_sales(日期,利润) VALUES ('invalid',2),('2023-01-01','NaN')"
    )
    r = generate_business_report(request(sample, mapping={}))
    assert r["statistics"]["excluded_rows"] == 2
    assert r["statistics"]["delta"] == 20


def test_overlapping_periods_rejected(sample):
    with pytest.raises(ValidationError):
        request(sample, base_end="2023-01-05")


def test_week_comparison_no_false_yoy(sample):
    r = generate_business_report(request(sample, grain="week", mapping={}))
    assert all(x["yoy_delta"] is None for x in r["series"])


def test_upload_csv_to_general_report_end_to_end(tmp_path):
    from fastapi.testclient import TestClient

    from data_analysis.config import settings
    from data_analysis.main import app

    old = settings.API_KEYS
    settings.API_KEYS = "test-api-key"
    old_dirs = settings.IMPORT_ALLOWED_DIRS
    settings.IMPORT_ALLOWED_DIRS = str(tmp_path)
    client = TestClient(app, headers={"X-API-Key": "test-api-key"})
    path = tmp_path / "business.csv"
    path.write_text("日期,区域,收入\n2020-01-01,A,100\n2020-02-01,A,70\n", encoding="utf-8")
    try:
        imported = client.post(
            "/api/v1/import/file", data={"file_path": str(path), "dataset_name": "business"}
        )
        assert imported.status_code == 200
        sid = imported.json()["session_id"]
        discovered = client.post(
            "/api/v1/reports/discover", json={"session_id": sid, "dataset_name": "business"}
        )
        assert discovered.status_code == 200
        d = discovered.json()
        result = client.post(
            "/api/v1/reports/generate",
            json={
                "session_id": sid,
                "dataset_name": "business",
                "metric": "收入",
                "time_column": "日期",
                "dimensions": ["区域"],
                **d["periods"],
            },
        )
        assert result.status_code == 200, result.text
        assert result.json()["statistics"]["delta"] == -30
        assert result.json()["skipped"]
        SessionManager().drop_session(sid)
    finally:
        settings.API_KEYS = old
        settings.IMPORT_ALLOWED_DIRS = old_dirs
