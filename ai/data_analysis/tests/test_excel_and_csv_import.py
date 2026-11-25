import io
import os
import zipfile

from fastapi.testclient import TestClient

from data_analysis.config import settings

settings.API_KEYS = "test-api-key"

from data_analysis.connectors.excel_reader import FastExcelReader
from data_analysis.connectors.local import LocalFileConnector
from data_analysis.main import app
from data_analysis.mcp_server import import_excel_or_csv

client = TestClient(app, headers={"X-API-Key": "test-api-key"})


def create_mock_excel_bytes():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types></Types>')
        z.writestr(
            "xl/workbook.xml",
            '<workbook><sheets><sheet name="Orders" sheetId="1"/></sheets></workbook>',
        )
        z.writestr(
            "xl/sharedStrings.xml",
            "<sst><si><t>OrderID</t></si><si><t>Item</t></si><si><t>Price</t></si><si><t>Laptop</t></si><si><t>Phone</t></si></sst>",
        )
        z.writestr(
            "xl/worksheets/sheet1.xml",
            """<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2"><v>101</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>1299.99</v></c></row>
<row r="3"><c r="A3"><v>102</v></c><c r="B3" t="s"><v>4</v></c><c r="C3"><v>799.50</v></c></row>
</sheetData></worksheet>""",
        )
    buf.seek(0)
    return buf.getvalue()


def test_fast_excel_reader():
    raw_bytes = create_mock_excel_bytes()
    tbl = FastExcelReader.read_xlsx_to_arrow(raw_bytes)
    assert tbl.num_rows == 2
    assert tbl.num_columns == 3
    assert "OrderID" in tbl.column_names
    assert "Item" in tbl.column_names
    assert "Price" in tbl.column_names


def test_local_connector_excel_and_csv(tmp_path):
    # 1. Test Excel
    excel_path = os.path.join(tmp_path, "test_orders.xlsx")
    with open(excel_path, "wb") as f:
        f.write(create_mock_excel_bytes())

    connector = LocalFileConnector(f"file://{excel_path}")
    assert connector.test_connection() is True
    sheets = connector.list_tables()
    assert "Orders" in sheets

    arrow_tbl = connector.fetch_to_arrow(query_or_table="Orders")
    assert arrow_tbl.num_rows == 2

    # 2. Test CSV
    csv_path = os.path.join(tmp_path, "test_data.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write("id,category,amount\n1,Electronics,500.0\n2,Clothing,120.0\n3,Home,80.5\n")

    csv_connector = LocalFileConnector(f"file://{csv_path}")
    assert csv_connector.test_connection() is True
    csv_tbl = csv_connector.fetch_to_arrow(query_or_table="test_data.csv")
    assert csv_tbl.num_rows == 3


def test_mcp_import_excel(tmp_path):
    excel_path = os.path.join(tmp_path, "mcp_test.xlsx")
    with open(excel_path, "wb") as f:
        f.write(create_mock_excel_bytes())

    res_json = import_excel_or_csv(
        file_path=excel_path, dataset_name="mcp_excel_table", session_id="excel_mcp_session"
    )
    assert "success" in res_json
    assert "2" in res_json  # 2 rows


def test_api_file_upload():
    raw_bytes = create_mock_excel_bytes()
    resp = client.post(
        "/api/v1/import/file",
        files={
            "file": (
                "upload_test.xlsx",
                raw_bytes,
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        },
        data={"dataset_name": "api_uploaded_excel", "session_id": "api_upload_session"},
    )
    assert resp.status_code == 200
    res = resp.json()
    assert res["status"] == "success"
    assert res["row_count"] == 2
    assert "OrderID" in res["columns"]
