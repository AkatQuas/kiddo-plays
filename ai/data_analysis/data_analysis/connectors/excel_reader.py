import datetime as _dt
import io
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile
from typing import Any

import pyarrow as pa

# Legacy BIFF (.xls) files start with the OLE2 compound-document magic. They are
# not zip archives, so they can never be read here; say so instead of surfacing
# a BadZipFile from deep inside zipfile.
_OLE2_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"

# Built-in number-format ids that render as a date / time. 14-22 and 45-47 are
# the classic ones; 27-36 and 50-58 are the CJK locale date formats that Excel
# and WPS write for Chinese / Japanese / Korean workbooks.
_BUILTIN_DATE_FMT_IDS = frozenset(
    list(range(14, 23)) + list(range(27, 37)) + list(range(45, 48)) + list(range(50, 59))
)

_INT64_MAX = 2**63 - 1
_HEADER_SCAN_ROWS = 10


def _local(tag: str) -> str:
    """Tag name without its XML namespace, so namespaced and bare documents parse alike."""
    return tag.rsplit("}", 1)[-1]


def _is_date_format(format_code: str) -> bool:
    """True when a custom number format renders a date or time.

    Quoted literals, escaped characters and [bracket] sections (colours, locale,
    elapsed-time markers are handled below) are stripped first so that a literal
    like "d" inside quotes does not count.
    """
    if not format_code:
        return False
    code = format_code
    if code.lower() == "general":
        return False
    code = re.sub(r'"[^"]*"', "", code)
    code = re.sub(r"\\.", "", code)
    # [h] / [mm] / [ss] are elapsed-time formats: keep those, drop the rest.
    if re.search(r"\[(h+|m+|s+)\]", code, re.IGNORECASE):
        return True
    code = re.sub(r"\[[^\]]*\]", "", code)
    return re.search(r"[dmyhs]", code, re.IGNORECASE) is not None


class FastExcelReader:
    """
    Dependency-free XLSX-to-Arrow reader (zipfile + incremental XML parsing).

    Worksheet XML is consumed with ``iterparse`` and each ``<row>`` element is
    released as soon as it has been read, so the XML tree never grows with the
    sheet. Cell values are still accumulated column-wise in Python lists before
    the Arrow table is built: memory is proportional to the sheet's data, not
    constant.

    Reads what real Excel / WPS / openpyxl workbooks contain: shared and inline
    strings (rich text included), styled cells, date and datetime cells (1900
    and 1904 epochs), booleans, formula results, sheet-to-file mapping through
    ``workbook.xml.rels``, and a title row above the header. Legacy ``.xls`` is
    rejected with a clear error.
    """

    @staticmethod
    def _col_letter_to_index(col_str: str) -> int:
        """Convert Excel column letters (A, B, ..., Z, AA, AB) to 0-based integer index."""
        result = 0
        for char in col_str:
            result = result * 26 + (ord(char.upper()) - ord("A") + 1)
        return result - 1

    # ------------------------------------------------------------------ workbook parts

    @classmethod
    def _load_shared_strings(cls, z: zipfile.ZipFile) -> list[str]:
        """Parse xl/sharedStrings.xml into a string lookup list."""
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" not in z.namelist():
            return shared_strings

        with z.open("xl/sharedStrings.xml") as f:
            parts: list[str] = []
            phonetic_depth = 0
            for event, elem in ET.iterparse(f, events=("start", "end")):
                tag = _local(elem.tag)
                if event == "start":
                    # <rPh> holds phonetic guides (furigana); it is not cell text.
                    if tag == "rPh":
                        phonetic_depth += 1
                    continue
                if tag == "rPh":
                    phonetic_depth -= 1
                elif tag == "t" and phonetic_depth == 0:
                    parts.append(elem.text or "")
                elif tag == "si":
                    shared_strings.append("".join(parts))
                    parts = []
                    elem.clear()
        return shared_strings

    @classmethod
    def _load_sheet_entries(cls, z: zipfile.ZipFile) -> list[tuple[str, str | None]]:
        """Worksheets in workbook order as (name, zip path or None when unresolved)."""
        if "xl/workbook.xml" not in z.namelist():
            return []

        rel_targets: dict[str, str] = {}
        rels_path = "xl/_rels/workbook.xml.rels"
        if rels_path in z.namelist():
            with z.open(rels_path) as f:
                for rel in ET.parse(f).getroot():
                    if _local(rel.tag) != "Relationship":
                        continue
                    target = rel.attrib.get("Target", "")
                    if target.startswith("/"):
                        resolved = target.lstrip("/")
                    else:
                        resolved = posixpath.normpath(posixpath.join("xl", target))
                    rel_targets[rel.attrib.get("Id", "")] = resolved

        entries: list[tuple[str, str | None]] = []
        with z.open("xl/workbook.xml") as f:
            root = ET.parse(f).getroot()
        for elem in root.iter():
            if _local(elem.tag) != "sheet":
                continue
            name = elem.attrib.get("name")
            if name is None:
                continue
            rel_id = next((v for k, v in elem.attrib.items() if _local(k) == "id"), None)
            path = rel_targets.get(rel_id) if rel_id else None
            # Chartsheets / macro sheets live outside xl/worksheets and hold no cells.
            if path is not None and not path.startswith("xl/worksheets/"):
                continue
            entries.append((name, path))
        return entries

    @classmethod
    def _is_1904_epoch(cls, z: zipfile.ZipFile) -> bool:
        if "xl/workbook.xml" not in z.namelist():
            return False
        with z.open("xl/workbook.xml") as f:
            for elem in ET.parse(f).getroot().iter():
                if _local(elem.tag) == "workbookPr":
                    return elem.attrib.get("date1904", "0") in ("1", "true")
        return False

    @classmethod
    def _load_date_styles(cls, z: zipfile.ZipFile) -> list[bool]:
        """For every cell style index (the ``s`` attribute): does it render as a date?"""
        if "xl/styles.xml" not in z.namelist():
            return []
        with z.open("xl/styles.xml") as f:
            root = ET.parse(f).getroot()

        custom_formats: dict[int, str] = {}
        cell_xfs: ET.Element | None = None
        for elem in root:
            tag = _local(elem.tag)
            if tag == "numFmts":
                for fmt in elem:
                    try:
                        custom_formats[int(fmt.attrib.get("numFmtId", ""))] = fmt.attrib.get(
                            "formatCode", ""
                        )
                    except ValueError:
                        continue
            elif tag == "cellXfs":
                cell_xfs = elem

        flags: list[bool] = []
        if cell_xfs is None:
            return flags
        for xf in cell_xfs:
            try:
                fmt_id = int(xf.attrib.get("numFmtId", "0"))
            except ValueError:
                fmt_id = 0
            if fmt_id in custom_formats:
                flags.append(_is_date_format(custom_formats[fmt_id]))
            else:
                flags.append(fmt_id in _BUILTIN_DATE_FMT_IDS)
        return flags

    @classmethod
    def list_sheet_names(cls, z: zipfile.ZipFile) -> list[str]:
        """List all worksheet names in the workbook."""
        names = [name for name, _ in cls._load_sheet_entries(z)]
        return names or ["Sheet1"]

    @classmethod
    def list_sheets(cls, path: str) -> list[str]:
        """List worksheet names for a workbook path."""
        with zipfile.ZipFile(path) as z:
            return cls.list_sheet_names(z)

    # ------------------------------------------------------------------ cell decoding

    @staticmethod
    def _serial_to_date(serial: float, epoch_1904: bool) -> _dt.date | _dt.datetime | float:
        """Excel serial number -> date (whole days) or datetime (with a time part)."""
        if epoch_1904:
            base = _dt.datetime(1904, 1, 1)
        else:
            # 1900 epoch with Excel's phantom 1900-02-29: serial 61 is 1900-03-01.
            base = _dt.datetime(1899, 12, 30)
            if serial < 61:
                base = _dt.datetime(1899, 12, 31)
        try:
            moment = base + _dt.timedelta(days=serial)
        except (OverflowError, ValueError):
            return serial
        if float(serial).is_integer():
            return moment.date()
        # Serials carry float noise (0.5 days is exact, 1/3 day is not): round to ms.
        micro = round(moment.microsecond / 1000.0) * 1000
        moment = moment.replace(microsecond=0) + _dt.timedelta(microseconds=micro)
        return moment

    @classmethod
    def _decode_cell(
        cls,
        cell: ET.Element,
        shared_strings: list[str],
        date_styles: list[bool],
        epoch_1904: bool,
    ) -> Any:
        cell_type = cell.attrib.get("t", "n")
        raw: str | None = None
        inline_parts: list[str] = []
        for child in cell:
            tag = _local(child.tag)
            if tag == "v":
                raw = child.text
            elif tag == "is":
                for node in child.iter():
                    if _local(node.tag) == "t":
                        inline_parts.append(node.text or "")

        if cell_type == "inlineStr":
            text = "".join(inline_parts)
            return text if text != "" else None
        if raw is None or raw == "":
            return None
        if cell_type == "s":
            try:
                text = shared_strings[int(raw)]
            except (ValueError, IndexError):
                return None
            return text if text != "" else None
        if cell_type == "str":
            return raw
        if cell_type == "b":
            return raw == "1"
        if cell_type == "e":
            # #N/A, #DIV/0! ... are not data.
            return None
        if cell_type == "d":
            try:
                parsed = _dt.datetime.fromisoformat(raw.rstrip("Z"))
            except ValueError:
                return raw
            return parsed.date() if parsed.time() == _dt.time(0, 0) else parsed

        # Numeric (t="n" or absent). A date is a number whose style says so.
        try:
            number: int | float = float(raw) if re.search(r"[.eE]", raw) else int(raw)
        except ValueError:
            return raw
        style_attr = cell.attrib.get("s")
        if style_attr is not None:
            try:
                is_date = date_styles[int(style_attr)]
            except (ValueError, IndexError):
                is_date = False
            if is_date:
                return cls._serial_to_date(float(number), epoch_1904)
        return number

    # ------------------------------------------------------------------ table assembly

    @staticmethod
    def _stringify(value: Any) -> str:
        if isinstance(value, bool):
            return "TRUE" if value else "FALSE"
        if isinstance(value, float) and value.is_integer() and abs(value) < 1e15:
            return str(int(value))
        if isinstance(value, _dt.datetime):
            return value.isoformat(sep=" ")
        return str(value)

    @classmethod
    def _column_to_arrow(cls, values: list[Any]) -> pa.Array:
        """One Arrow array per column; a column of mixed kinds becomes strings."""
        kinds = set()
        for v in values:
            if v is None:
                continue
            if isinstance(v, bool):
                kinds.add("bool")
            elif isinstance(v, int):
                kinds.add("int" if abs(v) <= _INT64_MAX else "str")
            elif isinstance(v, float):
                kinds.add("float")
            elif isinstance(v, _dt.datetime):
                kinds.add("datetime")
            elif isinstance(v, _dt.date):
                kinds.add("date")
            else:
                kinds.add("str")

        if not kinds:
            return pa.nulls(len(values))
        if kinds == {"bool"}:
            return pa.array(values, type=pa.bool_())
        if kinds == {"int"}:
            return pa.array(values, type=pa.int64())
        if kinds <= {"int", "float"}:
            return pa.array([None if v is None else float(v) for v in values], type=pa.float64())
        if kinds == {"date"}:
            return pa.array(values, type=pa.date32())
        if kinds <= {"date", "datetime"}:
            widened = [
                _dt.datetime(v.year, v.month, v.day)
                if isinstance(v, _dt.date) and not isinstance(v, _dt.datetime)
                else v
                for v in values
            ]
            return pa.array(widened, type=pa.timestamp("ms"))
        return pa.array(
            [None if v is None else cls._stringify(v) for v in values], type=pa.string()
        )

    @staticmethod
    def _pick_header_row(rows: list[list[Any]]) -> int:
        """Index of the header row among the first rows read.

        Real workbooks often carry a title or note above the header (one merged
        cell). The header is the first row that is at least half as wide as the
        widest of the leading rows; a genuinely single-column sheet keeps row 0.
        """
        head = rows[:_HEADER_SCAN_ROWS]
        widths = [sum(1 for v in row if v is not None) for row in head]
        widest = max(widths, default=0)
        threshold = max(2, (widest + 1) // 2)
        for idx, width in enumerate(widths):
            if width >= threshold:
                return idx
        return 0

    @classmethod
    def read_xlsx_to_arrow(
        cls,
        file_source: str | bytes | io.BytesIO,
        sheet_name: str | None = None,
        sheet_index: int = 0,
        has_header: bool = True,
        limit_rows: int | None = None,
    ) -> pa.Table:
        """
        Parse one XLSX worksheet into a PyArrow Table.

        ``sheet_name`` selects a sheet by name. The placeholder ``"Sheet1"`` (what
        callers pass when the user named no sheet) falls back to ``sheet_index``
        when the workbook has no sheet of that name; any other unknown name is an
        error that lists the sheets that do exist.
        """
        if isinstance(file_source, bytes):
            f_obj = io.BytesIO(file_source)
        elif isinstance(file_source, io.BytesIO):
            f_obj = file_source
        else:
            f_obj = open(file_source, "rb")

        try:
            magic = f_obj.read(8)
            f_obj.seek(0)
            if magic == _OLE2_MAGIC:
                raise ValueError(
                    "Legacy .xls (Excel 97-2003 binary) workbooks are not supported. "
                    "Save the file as .xlsx or .csv and import that instead."
                )

            with zipfile.ZipFile(f_obj) as z:
                namelist = set(z.namelist())
                entries = cls._load_sheet_entries(z)
                names = [name for name, _ in entries]

                target_idx = sheet_index
                if sheet_name:
                    if sheet_name in names:
                        target_idx = names.index(sheet_name)
                    elif sheet_name != "Sheet1":
                        raise ValueError(
                            f"Worksheet '{sheet_name}' not found. Available sheets: {', '.join(names) or '(none)'}"
                        )

                sheet_xml_path: str | None = None
                if 0 <= target_idx < len(entries):
                    sheet_xml_path = entries[target_idx][1]
                if sheet_xml_path is None or sheet_xml_path not in namelist:
                    # No usable relationship part (hand-built files): fall back to the
                    # conventional sheetN.xml naming, then to the first sheet present.
                    guess = f"xl/worksheets/sheet{target_idx + 1}.xml"
                    if guess in namelist:
                        sheet_xml_path = guess
                    else:
                        sheet_files = sorted(
                            n
                            for n in namelist
                            if n.startswith("xl/worksheets/sheet") and n.endswith(".xml")
                        )
                        if not sheet_files:
                            raise ValueError("No worksheets found in XLSX file.")
                        sheet_xml_path = sheet_files[0]

                shared_strings = cls._load_shared_strings(z)
                date_styles = cls._load_date_styles(z)
                epoch_1904 = cls._is_1904_epoch(z)

                rows_data: list[list[Any]] = []
                header_idx: int | None = None if has_header else -1

                with z.open(sheet_xml_path) as sheet_f:
                    for _event, elem in ET.iterparse(sheet_f, events=("end",)):
                        if _local(elem.tag) != "row":
                            continue

                        row_cells: dict[int, Any] = {}
                        next_col = 0
                        for cell in elem:
                            if _local(cell.tag) != "c":
                                continue
                            ref = cell.attrib.get("r")
                            match = re.match(r"([A-Za-z]+)", ref) if ref else None
                            col_idx = (
                                cls._col_letter_to_index(match.group(1)) if match else next_col
                            )
                            next_col = col_idx + 1
                            value = cls._decode_cell(cell, shared_strings, date_styles, epoch_1904)
                            if isinstance(value, str):
                                value = value.strip()
                                if value == "":
                                    value = None
                            if value is not None:
                                row_cells[col_idx] = value
                        elem.clear()

                        if not row_cells:
                            continue
                        width = max(row_cells) + 1
                        rows_data.append([row_cells.get(i) for i in range(width)])

                        if limit_rows:
                            if header_idx is None and len(rows_data) >= _HEADER_SCAN_ROWS:
                                header_idx = cls._pick_header_row(rows_data)
                            if (
                                header_idx is not None
                                and len(rows_data) - (header_idx + 1) >= limit_rows
                            ):
                                break

                if not rows_data:
                    return pa.Table.from_pydict({})

                if has_header:
                    if header_idx is None:
                        header_idx = cls._pick_header_row(rows_data)
                    header_row = rows_data[header_idx]
                    data_rows = rows_data[header_idx + 1 :]
                else:
                    header_row = []
                    data_rows = rows_data
                if limit_rows:
                    data_rows = data_rows[:limit_rows]

                max_cols = max([len(header_row)] + [len(r) for r in data_rows])
                columns: list[list[Any]] = [[] for _ in range(max_cols)]
                for row in data_rows:
                    for i in range(max_cols):
                        columns[i].append(row[i] if i < len(row) else None)

                seen: dict[str, int] = {}
                out_names: list[str] = []
                out_arrays: list[pa.Array] = []
                for i in range(max_cols):
                    raw_header = header_row[i] if i < len(header_row) else None
                    has_name = raw_header is not None and str(raw_header).strip() != ""
                    has_data = any(v is not None for v in columns[i])
                    # Styled-but-empty trailing columns: no name and no data -> not a column.
                    if not has_name and not has_data:
                        continue
                    name = cls._stringify(raw_header).strip() if has_name else f"col_{i + 1}"
                    if name in seen:
                        seen[name] += 1
                        name = f"{name}_{seen[name]}"
                    else:
                        seen[name] = 0
                    out_names.append(name)
                    out_arrays.append(cls._column_to_arrow(columns[i]))

                return pa.Table.from_arrays(out_arrays, names=out_names)

        finally:
            if not isinstance(file_source, (io.BytesIO, bytes)):
                f_obj.close()
