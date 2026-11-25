from fastapi.testclient import TestClient

from data_analysis.config import settings

settings.API_KEYS = "test-api-key"

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.main import app

client = TestClient(app, headers={"X-API-Key": "test-api-key"})


def test_fastapi_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_fastapi_eda_and_spss_flow():
    mgr = SessionManager()
    sess = mgr.get_or_create_session("api_test_sess")
    con = sess.get_duckdb_conn()

    con.execute("""
    CREATE TABLE api_sample (
        dept VARCHAR,
        sales DOUBLE,
        bonus DOUBLE
    );
    INSERT INTO api_sample VALUES 
    ('Sales', 100.0, 10.0), ('Sales', 120.0, 12.0), ('Sales', 110.0, 11.0),
    ('Tech', 200.0, 25.0), ('Tech', 210.0, 26.0), ('Tech', 195.0, 24.0);
    """)

    # 1. Test EDA Endpoint
    eda_resp = client.post(
        "/api/v1/tools/eda", json={"session_id": "api_test_sess", "dataset_name": "api_sample"}
    )
    assert eda_resp.status_code == 200
    data = eda_resp.json()
    assert data["status"] == "success"
    assert "数据资产画像" in data["summary_text"]

    # 2. Test SPSS T-Test Endpoint
    spss_resp = client.post(
        "/api/v1/tools/spss_test",
        json={
            "session_id": "api_test_sess",
            "dataset_name": "api_sample",
            "test_type": "independent_t_test",
            "dependent_var": "sales",
            "group_var": "dept",
        },
    )
    assert spss_resp.status_code == 200
    s_data = spss_resp.json()
    assert s_data["status"] == "success"
    assert s_data["statistics"]["significant"] is True
    assert "SPSS 统计推断" in s_data["summary_text"]

    # 3. Test OLAP Endpoint
    olap_resp = client.post(
        "/api/v1/tools/olap",
        json={
            "session_id": "api_test_sess",
            "dataset_name": "api_sample",
            "dimensions": ["dept"],
            "metrics": ["sales", "bonus"],
            "agg_funcs": ["sum", "avg"],
        },
    )
    assert olap_resp.status_code == 200
    o_data = olap_resp.json()
    assert len(o_data["data_preview"]) == 2
