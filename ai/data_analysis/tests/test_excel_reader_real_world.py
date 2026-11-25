"""Regression tests for the shapes real Excel / WPS workbooks take.

The original reader was only ever exercised with a hand-built three-column file
whose cells looked like ``<c r="A1" t="s">``. Excel and WPS write the style
index first (``<c r="A1" s="4" t="s">``), put ``r`` anywhere on ``<row>``, and
map sheets to files through workbook.xml.rels. Every fixture below is built by
hand so the exact XML under test is visible.
"""

import datetime as dt
import io
import zipfile

import pyarrow as pa
import pytest

from data_analysis.connectors.excel_reader import FastExcelReader, _is_date_format

NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'
NS_R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'


def _workbook(
    sheets,
    shared=(),
    styles_xml=None,
    rels=None,
    date1904=False,
):
    """sheets: list of (name, rel_id, zip_path, sheet_data_xml)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        sheet_tags = "".join(
            f'<sheet name="{name}" sheetId="{i + 1}" r:id="{rid}"/>'
            for i, (name, rid, _p, _x) in enumerate(sheets)
        )
        pr = '<workbookPr date1904="1"/>' if date1904 else ""
        z.writestr(
            "xl/workbook.xml", f"<workbook {NS} {NS_R}>{pr}<sheets>{sheet_tags}</sheets></workbook>"
        )
        if rels is None:
            rels = [(rid, path.replace("xl/", "", 1)) for _n, rid, path, _x in sheets]
        rel_tags = "".join(
            f'<Relationship Id="{rid}" Type="x/worksheet" Target="{target}"/>'
            for rid, target in rels
        )
        z.writestr(
            "xl/_rels/workbook.xml.rels",
            f'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">{rel_tags}</Relationships>',
        )
        si = "".join(f"<si><t>{s}</t></si>" for s in shared)
        z.writestr("xl/sharedStrings.xml", f"<sst {NS}>{si}</sst>")
        if styles_xml is not None:
            z.writestr("xl/styles.xml", styles_xml)
        for _name, _rid, path, data in sheets:
            z.writestr(path, f"<worksheet {NS}><sheetData>{data}</sheetData></worksheet>")
    return buf.getvalue()


def test_styled_string_cells_resolve_to_text_not_shared_string_index():
    # Excel writes s="..." before t="s". The old regex only saw t when it came
    # right after r, so every styled text cell came back as its integer index.
    data = (
        '<row r="1" s="51" customFormat="1" ht="26" spans="1:3">'
        '<c r="A1" s="4" t="s"><v>0</v></c><c r="B1" s="58" t="s"><v>1</v></c></row>'
        '<row r="2"><c r="A2" s="7" t="s"><v>2</v></c><c r="B2" s="9"><v>9000</v></c></row>'
    )
    raw = _workbook(
        [("一车间", "rId1", "xl/worksheets/sheet1.xml", data)], shared=["客户", "数量", "诗佳"]
    )
    tbl = FastExcelReader.read_xlsx_to_arrow(raw)
    assert tbl.column_names == ["客户", "数量"]
    assert tbl.column("客户").to_pylist() == ["诗佳"]
    assert tbl.column("数量").to_pylist() == [9000]


def test_row_attribute_order_does_not_matter():
    # POI-style writers put r last: <row customHeight="true" ht="25" r="1">.
    # The old row regex required r first and silently returned an empty table.
    data = (
        '<row customHeight="true" ht="25" r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
        '<row customHeight="true" ht="20" r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>3</v></c></row>'
    )
    raw = _workbook(
        [("订单", "rId1", "xl/worksheets/sheet1.xml", data)], shared=["品名", "数量", "积木"]
    )
    tbl = FastExcelReader.read_xlsx_to_arrow(raw)
    assert tbl.num_rows == 1
    assert tbl.column("品名").to_pylist() == ["积木"]


def test_sheet_is_resolved_through_relationships_not_by_position():
    # Second sheet in workbook order lives in sheet1.xml (sheets were reordered).
    first = '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>0</v></c></row><row r="2"><c r="A2"><v>1</v></c><c r="B2"><v>1</v></c></row>'
    second = '<row r="1"><c r="A1" t="s"><v>1</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2"><v>2</v></c><c r="B2"><v>2</v></c></row>'
    raw = _workbook(
        [
            ("First", "rId7", "xl/worksheets/sheet2.xml", first),
            ("Second", "rId3", "xl/worksheets/sheet1.xml", second),
        ],
        shared=["from_first", "from_second"],
    )
    assert FastExcelReader.read_xlsx_to_arrow(raw, sheet_name="Second").column_names == [
        "from_second",
        "from_second_1",
    ]
    assert FastExcelReader.read_xlsx_to_arrow(raw, sheet_name="First").column_names == [
        "from_first",
        "from_first_1",
    ]
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        assert FastExcelReader.list_sheet_names(z) == ["First", "Second"]


def test_unknown_sheet_name_is_an_error_but_placeholder_sheet1_falls_back():
    data = '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>0</v></c></row><row r="2"><c r="A2"><v>1</v></c></row>'
    raw = _workbook([("数据", "rId1", "xl/worksheets/sheet1.xml", data)], shared=["h"])
    # Callers pass "Sheet1" when the user named no sheet.
    assert FastExcelReader.read_xlsx_to_arrow(raw, sheet_name="Sheet1").num_rows == 1
    with pytest.raises(ValueError, match="数据"):
        FastExcelReader.read_xlsx_to_arrow(raw, sheet_name="不存在")


STYLES = f"""<styleSheet {NS}>
<numFmts count="2">
  <numFmt numFmtId="176" formatCode="yyyy&quot;年&quot;m&quot;月&quot;d&quot;日&quot;"/>
  <numFmt numFmtId="177" formatCode="#,##0.00&quot; d&quot;"/>
</numFmts>
<cellXfs count="5">
  <xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="22"/><xf numFmtId="176"/><xf numFmtId="177"/>
</cellXfs></styleSheet>"""


def test_date_cells_become_dates_and_plain_numbers_stay_numbers():
    data = (
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c><c r="E1" t="s"><v>4</v></c></row>'
        '<row r="2"><c r="A2" s="1"><v>46030</v></c><c r="B2" s="2"><v>46030.5</v></c><c r="C2" s="3"><v>46274</v></c><c r="D2" s="4"><v>46030</v></c><c r="E2" s="0"><v>46030</v></c></row>'
    )
    raw = _workbook(
        [("S", "rId1", "xl/worksheets/sheet1.xml", data)],
        shared=["下单日期", "下单时间", "交货日期", "金额", "数量"],
        styles_xml=STYLES,
    )
    tbl = FastExcelReader.read_xlsx_to_arrow(raw)
    assert tbl.schema.field("下单日期").type == pa.date32()
    assert tbl.column("下单日期").to_pylist() == [dt.date(2026, 1, 8)]
    assert tbl.column("下单时间").to_pylist() == [dt.datetime(2026, 1, 8, 12, 0)]
    # Custom CJK format: yyyy"年"m"月"d"日"
    assert tbl.column("交货日期").to_pylist() == [dt.date(2026, 9, 9)]
    # A literal "d" inside quotes is not a date token.
    assert tbl.column("金额").to_pylist() == [46030]
    assert tbl.column("数量").to_pylist() == [46030]


def test_1904_epoch_and_early_1900_serials():
    data = '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>0</v></c></row><row r="2"><c r="A2" s="1"><v>0</v></c><c r="B2" s="1"><v>1</v></c></row>'
    raw = _workbook(
        [("S", "rId1", "xl/worksheets/sheet1.xml", data)],
        shared=["d"],
        styles_xml=STYLES,
        date1904=True,
    )
    tbl = FastExcelReader.read_xlsx_to_arrow(raw)
    assert tbl.column("d").to_pylist() == [dt.date(1904, 1, 1)]
    # 1900 epoch: serial 1 is 1900-01-01, serial 61 is 1900-03-01 (Excel's phantom Feb 29).
    assert FastExcelReader._serial_to_date(1, False) == dt.date(1900, 1, 1)
    assert FastExcelReader._serial_to_date(61, False) == dt.date(1900, 3, 1)


def test_date_format_detection():
    assert _is_date_format("yyyy-mm-dd")
    assert _is_date_format("[$-804]yyyy/m/d")
    assert _is_date_format("[h]:mm:ss")
    assert not _is_date_format("General")
    assert not _is_date_format("#,##0.00")
    assert not _is_date_format('0.00" days"')
    assert not _is_date_format("[Red]0.00")


def test_title_row_above_header_is_skipped():
    data = (
        '<row r="1"><c r="A1" s="1" t="s"><v>0</v></c></row>'
        '<row r="3"><c r="A3" t="s"><v>1</v></c><c r="B3" t="s"><v>2</v></c><c r="C3" t="s"><v>3</v></c></row>'
        '<row r="4"><c r="A4" t="s"><v>4</v></c><c r="B4"><v>2</v></c><c r="C4"><v>3.5</v></c></row>'
    )
    raw = _workbook(
        [("S", "rId1", "xl/worksheets/sheet1.xml", data)],
        shared=["2026 年 8 月物料清单", "物料", "数量", "单价", "螺丝"],
    )
    tbl = FastExcelReader.read_xlsx_to_arrow(raw)
    assert tbl.column_names == ["物料", "数量", "单价"]
    assert tbl.num_rows == 1


def test_mixed_column_becomes_text_instead_of_raising():
    # A code column holding both 1001 and "A-1002" used to raise ArrowTypeError.
    data = (
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>'
        '<row r="2"><c r="A2"><v>1001</v></c><c r="B2"><v>1</v></c></row>'
        '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>2.5</v></c></row>'
    )
    raw = _workbook(
        [("S", "rId1", "xl/worksheets/sheet1.xml", data)], shared=["编码", "数量", "A-1002"]
    )
    tbl = FastExcelReader.read_xlsx_to_arrow(raw)
    assert tbl.column("编码").to_pylist() == ["1001", "A-1002"]
    assert tbl.schema.field("数量").type == pa.float64()


def test_inline_strings_rich_text_booleans_errors_and_empty_styled_columns():
    data = (
        '<row r="1"><c r="A1" t="inlineStr"><is><t>名称</t></is></c><c r="B1" t="inlineStr"><is><t>启用</t></is></c>'
        '<c r="C1" t="inlineStr"><is><t>公式</t></is></c><c r="D1" s="3"/><c r="E1" s="3"/></row>'
        '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="b"><v>1</v></c><c r="C2" t="e"><v>#DIV/0!</v></c><c r="D2" s="3"/></row>'
        '<row r="3"><c r="A3" t="inlineStr"><is><t>B &amp; C</t></is></c><c r="B3" t="b"><v>0</v></c><c r="C3" t="str"><v>合计</v></c></row>'
    )
    buf = io.BytesIO(_workbook([("S", "rId1", "xl/worksheets/sheet1.xml", data)]))
    # Rich text: one <si> split into runs, plus a phonetic guide that is not text.
    patched = io.BytesIO()
    with zipfile.ZipFile(buf) as src, zipfile.ZipFile(patched, "w") as dst:
        for item in src.infolist():
            content = src.read(item.filename)
            if item.filename == "xl/sharedStrings.xml":
                content = (
                    f'<sst {NS}><si><r><t>红色</t></r><r><t xml:space="preserve"> 积木</t></r>'
                    "<rPh><t>ホンセ</t></rPh></si></sst>"
                ).encode()
            dst.writestr(item.filename, content)
    tbl = FastExcelReader.read_xlsx_to_arrow(patched.getvalue())
    assert tbl.column_names == ["名称", "启用", "公式"]
    assert tbl.column("名称").to_pylist() == ["红色 积木", "B & C"]
    assert tbl.column("启用").to_pylist() == [True, False]
    assert tbl.column("公式").to_pylist() == [None, "合计"]


def test_limit_rows_counts_data_rows():
    rows = '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>0</v></c></row>' + "".join(
        f'<row r="{i}"><c r="A{i}"><v>{i}</v></c><c r="B{i}"><v>{i}</v></c></row>'
        for i in range(2, 40)
    )
    raw = _workbook([("S", "rId1", "xl/worksheets/sheet1.xml", rows)], shared=["n"])
    assert FastExcelReader.read_xlsx_to_arrow(raw, limit_rows=5).num_rows == 5
    assert FastExcelReader.read_xlsx_to_arrow(raw).num_rows == 38


def test_legacy_xls_is_rejected_with_a_clear_message(tmp_path):
    path = tmp_path / "old.xls"
    path.write_bytes(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 512)
    with pytest.raises(ValueError, match="xlsx"):
        FastExcelReader.read_xlsx_to_arrow(str(path))
