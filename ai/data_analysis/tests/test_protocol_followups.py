import io
import zipfile

from fastapi.testclient import TestClient

from data_analysis.catalog.metadata_db import MetadataDB
from data_analysis.cluster.session_manager import SessionManager
from data_analysis.config import settings
from data_analysis.transform.pipeline_dag import DAGModel, PipelineDAG

settings.API_KEYS = "test-api-key"

from data_analysis.main import app

client = TestClient(app, headers={"X-API-Key": "test-api-key"})


def _sheet_xlsx() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr(
            "xl/workbook.xml",
            """
            <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets>
                <sheet name="Orders" sheetId="1" r:id="rId1"/>
              </sheets>
            </workbook>
            """,
        )
        zf.writestr(
            "xl/_rels/workbook.xml.rels",
            """
            <Relationships>
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
            </Relationships>
            """,
        )
        zf.writestr(
            "xl/worksheets/sheet1.xml",
            """
            <worksheet><sheetData>
              <row r="1"><c r="A1" t="inlineStr"><is><t>k</t></is></c></row>
              <row r="2"><c r="A2" t="inlineStr"><is><t>v</t></is></c></row>
            </sheetData></worksheet>
            """,
        )
    return buf.getvalue()


def test_omitted_sheet_reads_first_worksheet_and_missing_name_is_400(tmp_path):
    path = tmp_path / "book.xlsx"
    path.write_bytes(_sheet_xlsx())
    ok = client.post(
        "/api/v1/import/file",
        data={
            "file_path": str(path),
            "dataset_name": "first_sheet",
            "session_id": "proto_sheet_sess",
        },
    )
    assert ok.status_code == 200
    assert ok.json()["row_count"] == 1

    missing = client.post(
        "/api/v1/import/file",
        data={
            "file_path": str(path),
            "dataset_name": "missing_sheet",
            "session_id": "proto_sheet_sess",
            "sheet_name": "Sheet1",
        },
    )
    assert missing.status_code == 400
    assert "Sheet1" in missing.json()["detail"]


def test_upload_filename_rejects_traversal():
    resp = client.post(
        "/api/v1/import/file",
        files={"file": ("../evil.csv", b"a\n1\n", "text/csv")},
        data={"dataset_name": "nope", "session_id": "proto_upload_sess"},
    )
    assert resp.status_code == 400


def test_connect_unknown_scheme_is_400():
    resp = client.post(
        "/api/v1/connect",
        json={
            "conn_str": "clickhouse://localhost/db",
            "query_or_table": "t",
            "dataset_name": "ch",
        },
    )
    assert resp.status_code == 400


def test_ontology_traverse_value_error_is_400_and_graph_is_exposed():
    SessionManager().get_or_create_session("proto_ont_sess")
    missing = client.post(
        "/api/v1/ontology/instances/traverse",
        json={
            "session_id": "proto_ont_sess",
            "source_object_type": "NoSuchType",
            "source_instance_id": "1",
            "link_name": "no_link",
        },
    )
    assert missing.status_code == 400

    graph = client.get("/api/v1/ontology/entity_graph")
    assert graph.status_code == 200
    body = graph.json()
    assert "nodes" in body and "edges" in body and "broken_edges" in body


def test_wide_table_route_returns_columns():
    sess = SessionManager().get_or_create_session("proto_wide_sess")
    con = sess.get_duckdb_conn()
    con.execute("CREATE TABLE proto_fact (id INT, region VARCHAR)")
    con.execute("INSERT INTO proto_fact VALUES (1, 'E')")
    con.execute("CREATE TABLE proto_dim (region VARCHAR, label VARCHAR)")
    con.execute("INSERT INTO proto_dim VALUES ('E', 'East')")
    resp = client.post(
        "/api/v1/transform/wide",
        json={
            "session_id": "proto_wide_sess",
            "target_name": "proto_wide",
            "fact_table": "proto_fact",
            "dimension_joins": [
                {
                    "dim_table": "proto_dim",
                    "on": "proto_fact.region = proto_dim.region",
                    "select_cols": ["proto_dim.label"],
                }
            ],
        },
    )
    assert resp.status_code == 200
    assert "label" in resp.json()["columns"]


def test_dag_unique_key_roundtrip_and_clear(tmp_path):
    db = MetadataDB(str(tmp_path / "catalog.db"))
    db.save_dag_model(
        {
            "name": "orders_inc",
            "sql": "SELECT 1 AS id",
            "materialization": "incremental",
            "depends_on": [],
            "description": "",
            "unique_key": "id",
        }
    )
    saved = db.list_dag_models()
    assert saved[0]["unique_key"] == "id"
    assert db.delete_dag_model("orders_inc") is True
    assert db.list_dag_models() == []

    pipe = PipelineDAG(session_id="proto_dag_mem", persistent=False)
    pipe.persistent = True
    deleted = []

    class _Db:
        def delete_dag_model(self, name):
            deleted.append(name)
            return True

    pipe.db = _Db()
    pipe._models["orders_inc"] = DAGModel(name="orders_inc", sql="SELECT 1 AS id", unique_key="id")
    pipe.clear_models()
    assert deleted == ["orders_inc"]
    assert pipe.list_models() == []
