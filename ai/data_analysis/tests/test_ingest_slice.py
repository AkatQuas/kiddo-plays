"""Ingest-path gaps: file/SQLite load, Excel sheet resolution, session lifetime."""

import io
import os
import sqlite3
import time
import zipfile

import pyarrow as pa
import pytest

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.connectors import duckdb_scanner as scanner
from data_analysis.connectors.excel_reader import FastExcelReader
from data_analysis.connectors.factory import ConnectorFactory
from data_analysis.connectors.local import LocalFileConnector, resolve_local_path
from data_analysis.connectors.mysql import MySQLConnector
from data_analysis.connectors.partitioned_loader import PartitionedLoader
from data_analysis.connectors.postgres import PostgresConnector
from data_analysis.connectors.trace_importer import TraceImporter


def _xlsx(files: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, payload in files.items():
            zf.writestr(name, payload)
    return buf.getvalue()


def test_excel_sheet_follows_workbook_relationship_not_file_order():
    raw = _xlsx(
        {
            "xl/workbook.xml": """
            <workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
              <sheets>
                <sheet name="SheetB" sheetId="2" r:id="rId2"/>
                <sheet name="SheetA" sheetId="1" r:id="rId1"/>
              </sheets>
            </workbook>
        """,
            "xl/_rels/workbook.xml.rels": """
            <Relationships>
              <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
              <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
            </Relationships>
        """,
            "xl/worksheets/sheet1.xml": """
            <worksheet><sheetData>
              <row r="1"><c r="A1" t="inlineStr"><is><t>k</t></is></c></row>
              <row r="2"><c r="A2" t="inlineStr"><is><t>from-a</t></is></c></row>
            </sheetData></worksheet>
        """,
            "xl/worksheets/sheet2.xml": """
            <worksheet><sheetData>
              <row r="1"><c r="A1" t="inlineStr"><is><t>k</t></is></c></row>
              <row r="2"><c r="A2" t="inlineStr"><is><t>from-b</t></is></c></row>
            </sheetData></worksheet>
        """,
        }
    )
    tbl = FastExcelReader.read_xlsx_to_arrow(raw, sheet_name="SheetB")
    assert tbl.column("k").to_pylist() == ["from-b"]


def test_excel_shared_string_ignores_attribute_order_and_unescapes():
    raw = _xlsx(
        {
            "xl/workbook.xml": '<workbook><sheets><sheet name="S" sheetId="1"/></sheets></workbook>',
            "xl/sharedStrings.xml": "<sst><si><t>A &amp; B</t></si><si><t>Hello</t></si></sst>",
            "xl/worksheets/sheet1.xml": """
            <worksheet><sheetData>
              <row r="1"><c r="A1" s="5" t="s"><v>0</v></c></row>
              <row r="2"><c r="A2" s="5" t="s"><v>1</v></c></row>
            </sheetData></worksheet>
        """,
        }
    )
    tbl = FastExcelReader.read_xlsx_to_arrow(raw, has_header=False)
    assert tbl.column("col_1").to_pylist() == ["A & B", "Hello"]


def test_excel_mixed_column_becomes_text_and_missing_sheet_errors():
    raw = _xlsx(
        {
            "xl/workbook.xml": '<workbook><sheets><sheet name="S" sheetId="1"/></sheets></workbook>',
            "xl/worksheets/sheet1.xml": """
            <worksheet><sheetData>
              <row r="1"><c r="A1" t="inlineStr"><is><t>v</t></is></c></row>
              <row r="2"><c r="A2"><v>1</v></c></row>
              <row r="3"><c r="A3" t="inlineStr"><is><t>x</t></is></c></row>
            </sheetData></worksheet>
        """,
        }
    )
    tbl = FastExcelReader.read_xlsx_to_arrow(raw)
    assert tbl.column("v").to_pylist() == ["1", "x"]
    with pytest.raises(ValueError, match="not found"):
        FastExcelReader.read_xlsx_to_arrow(raw, sheet_name="Missing")


def test_legacy_xls_is_rejected():
    payload = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 32
    with pytest.raises(ValueError, match="xls"):
        FastExcelReader.read_xlsx_to_arrow(payload)


def test_excel_filter_is_applied_before_limit(tmp_path):
    raw = _xlsx(
        {
            "xl/workbook.xml": '<workbook><sheets><sheet name="Orders" sheetId="1"/></sheets></workbook>',
            "xl/sharedStrings.xml": "<sst><si><t>Item</t></si><si><t>Price</t></si><si><t>Laptop</t></si><si><t>Phone</t></si></sst>",
            "xl/worksheets/sheet1.xml": """
            <worksheet><sheetData>
              <row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>
              <row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>1299.99</v></c></row>
              <row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3"><v>799.50</v></c></row>
            </sheetData></worksheet>
        """,
        }
    )
    path = tmp_path / "orders.xlsx"
    path.write_bytes(raw)
    tbl = LocalFileConnector(f"file://{path}").fetch_to_arrow(
        "Orders", filter_sql="Price < 1000", limit=1
    )
    assert tbl.column("Item").to_pylist() == ["Phone"]


def test_csv_with_quote_in_name_is_queryable_and_bad_rows_fail(tmp_path):
    good = tmp_path / "O'Brien.csv"
    good.write_text("id,city\n1,BJ\n2,SH\n", encoding="utf-8")
    connector = ConnectorFactory.get_connector(str(good))
    assert connector.test_connection() is True
    schema = connector.introspect_schema("ignored")
    assert [c.name for c in schema.columns] == ["id", "city"]
    tbl = connector.fetch_to_arrow("ignored", select_cols=["city"], filter_sql="id = 2")
    sess = SessionManager().get_or_create_session("ingest_csv_quote_sess")
    sess.register_dataset("cities", tbl)
    assert sess.execute_sql("SELECT city FROM cities").column("city").to_pylist() == ["SH"]

    bad = tmp_path / "bad.csv"
    bad.write_text("a,b\n1,2\nonlyone\n3,4\n", encoding="utf-8")
    with pytest.raises(ValueError, match="unreadable"):
        LocalFileConnector(f"file://{bad}").fetch_to_arrow("bad.csv")


def test_sqlite_lists_describes_and_loads_into_session(tmp_path):
    db = tmp_path / "shop.sqlite"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE orders (id INTEGER, city TEXT)")
    con.executemany("INSERT INTO orders VALUES (?, ?)", [(1, "BJ"), (2, "SH")])
    con.commit()
    con.close()

    connector = LocalFileConnector(f"sqlite:///{db}")
    assert connector.list_tables() == ["orders"]
    schema = connector.introspect_schema("orders")
    assert [c.name for c in schema.columns] == ["id", "city"]
    arrow = connector.fetch_to_arrow("orders", select_cols=["city"], filter_sql="id = 2")
    sess = SessionManager().get_or_create_session("ingest_sqlite_sess")
    sess.register_dataset("orders", arrow)
    assert sess.execute_sql("SELECT city FROM orders").column("city").to_pylist() == ["SH"]


def test_file_uri_keeps_relative_upload_paths():
    assert (
        resolve_local_path("file://data/uploads/upload_test.xlsx")
        == "data/uploads/upload_test.xlsx"
    )
    assert resolve_local_path("file:///tmp/a.csv") == "/tmp/a.csv"
    assert resolve_local_path("sqlite:///tmp/shop.sqlite") == "/tmp/shop.sqlite"


def test_missing_file_and_unknown_scheme():
    with pytest.raises(FileNotFoundError):
        LocalFileConnector("/tmp/does-not-exist-ingest.csv").fetch_to_arrow("t")
    with pytest.raises(ValueError, match="Unsupported connection scheme"):
        ConnectorFactory.get_connector("clickhouse://localhost/db")
    with pytest.raises(ValueError, match="non-empty"):
        ConnectorFactory.get_connector("  ")


def test_local_partitions_cover_every_row_once(tmp_path):
    path = tmp_path / "parts.csv"
    path.write_text("id,city\n1,BJ\n2,SH\n3,GZ\n4,BJ\n", encoding="utf-8")
    full = LocalFileConnector(str(path)).fetch_to_arrow("parts.csv")
    parts = PartitionedLoader.load_parallel(
        str(path), "parts.csv", partition_col="city", num_partitions=2
    )
    assert sorted(parts.column("id").to_pylist()) == sorted(full.column("id").to_pylist())
    with pytest.raises(ValueError, match="num_partitions"):
        PartitionedLoader.load_parallel(str(path), "parts.csv", num_partitions=0)


def test_introspect_escapes_table_name_literals(monkeypatch):
    seen = {}

    def fake_read_sql(_conn, query, return_type="arrow"):
        del return_type
        seen["query"] = query
        return pa.table(
            {
                "column_name": pa.array([], type=pa.string()),
                "data_type": pa.array([], type=pa.string()),
                "is_nullable": pa.array([], type=pa.string()),
            }
        )

    monkeypatch.setattr("data_analysis.connectors.mysql.cx.read_sql", fake_read_sql)
    MySQLConnector("mysql://u:p@h/db").introspect_schema("a' OR '1'='1")
    assert "table_name = 'a'' OR ''1''=''1'" in seen["query"]

    monkeypatch.setattr("data_analysis.connectors.postgres.cx.read_sql", fake_read_sql)
    PostgresConnector("postgresql://u:p@h/db").introspect_schema("public.orders")
    assert "table_schema = 'public'" in seen["query"]
    assert "table_name = 'orders'" in seen["query"]


def test_mysql_scanner_quotes_password_with_spaces():
    target = scanner.attach_target("mysql", "mysql://root:secret%20word@10.0.0.5:3306/warehouse")
    assert "password='secret word'" in target
    assert "host=10.0.0.5" in target
    clause = scanner.attach_clause("mysql", "mysql://root:secret%20word@10.0.0.5:3306/warehouse")
    assert "password=''secret word''" in clause
    with pytest.raises(ValueError, match="alias"):
        scanner.attach_clause("sqlite", "sqlite:///a.db", alias="src;drop")


def test_otlp_bad_timestamp_and_page_title_do_not_drop_the_span():
    otlp = {
        "resourceSpans": [
            {
                "resource": {
                    "attributes": [{"key": "service.name", "value": {"stringValue": "web"}}]
                },
                "scopeSpans": [
                    {
                        "spans": [
                            {
                                "traceId": "t",
                                "spanId": "s",
                                "name": "view",
                                "startTimeUnixNano": "not-a-time",
                                "attributes": [
                                    {"key": "page.title", "value": {"stringValue": "Cart"}}
                                ],
                            }
                        ],
                    }
                ],
            }
        ],
    }
    row = TraceImporter.to_arrow(TraceImporter.from_otlp(otlp)).to_pylist()[0]
    assert row["page_title"] == "Cart"
    assert row["event_id"] == "s"
    assert isinstance(row["timestamp_ms"], int)


def test_session_id_rejects_path_traversal_and_ttl_deletes_tempdir():
    with pytest.raises(ValueError, match="session_id"):
        SessionManager().get_or_create_session("../etc/passwd")
    assert all(row["session_id"] != "../etc/passwd" for row in SessionManager().list_sessions())
    unicode_sess = SessionManager().get_or_create_session("分析会话")
    unicode_sess.register_dataset("订单", pa.table({"n": [1]}))
    assert unicode_sess.execute_sql('SELECT n FROM "订单"').column("n").to_pylist() == [1]

    sid = "ingest_ttl_sess"
    sess = SessionManager().get_or_create_session(sid)
    temp_dir = sess._temp_dir
    assert os.path.isdir(temp_dir)
    sess.last_accessed_at = time.time() - 10_000
    SessionManager()._cleanup_expired_sessions()
    assert SessionManager().get_session(sid) is None
    assert not os.path.exists(temp_dir)


def test_session_rejects_bad_dataset_name_and_non_integer_limit():
    sess = SessionManager().get_or_create_session("ingest_limit_sess")
    sess.register_dataset("nums", pa.table({"n": [1, 2, 3]}))
    with pytest.raises(ValueError, match="dataset name"):
        sess.register_dataset('bad"name', pa.table({"a": [1]}))
    with pytest.raises(ValueError, match="limit"):
        sess.execute_sql("SELECT * FROM nums", limit="1; DROP TABLE nums")
    assert sess.execute_sql("SELECT * FROM nums", limit=1).num_rows == 1
    assert sess.execute_sql("SELECT count(*) AS n FROM nums").column("n").to_pylist() == [3]
