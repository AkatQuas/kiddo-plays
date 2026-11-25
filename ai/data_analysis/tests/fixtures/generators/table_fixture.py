"""Streaming deterministic XLSX fixtures, using only Python's standard library."""

import hashlib
import json
import zipfile
from datetime import date, timedelta
from pathlib import Path
from random import Random
from xml.sax.saxutils import escape

from tests.fixtures.expected.checks import COLUMNS, Expected

VERSION = "generic-table-quality@1"
ROOT = Path(__file__).resolve().parents[3]
SPEC = ROOT / "tests/fixtures/specs/table-quality-v1.json"
NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def profile(name):
    spec = json.loads(SPEC.read_text())
    if name not in spec["profiles"]:
        raise ValueError(f"Unknown profile: {name}")
    return {
        **spec["defaults"],
        **spec["profiles"][name],
        "profile": name,
        "suite_id": spec["suite_id"],
        "generator_version": spec["generator_version"],
    }


def records(config):
    size = config["rows"]
    defects = config["defects"]
    if isinstance(size, bool) or not isinstance(size, int) or not 1 <= size <= 1_048_575:
        raise ValueError("rows must fit one XLSX sheet including its header")
    if any(isinstance(v, bool) or not isinstance(v, int) or v < 0 for v in defects.values()):
        raise ValueError("defect counts must be non-negative integers")
    duplicates, empty, mismatch = (
        defects[k] for k in ("duplicate_extra", "empty_party", "amount_mismatch")
    )
    if duplicates + empty + mismatch >= size:
        raise ValueError("Defects are disjoint and require a first valid row")
    rng = Random(config["seed"])
    start, end = date.fromisoformat(config["start_date"]), date.fromisoformat(config["end_date"])
    span = (end - start).days + 1
    if span < 1:
        raise ValueError("end_date precedes start_date")
    regions = ("R1", "R2", "R3", "R4")
    for i in range(1, size + 1):
        quantity = rng.randint(1, 20)
        unit_minor = rng.randint(100, 99999)
        amount_minor = quantity * unit_minor
        if duplicates + empty + 2 <= i <= duplicates + empty + mismatch + 1:
            amount_minor += 1
        unit = f"{unit_minor // 100}.{unit_minor % 100:02d}"
        amount = f"{amount_minor // 100}.{amount_minor % 100:02d}"
        cost_minor = quantity * (unit_minor * 3 // 5)
        cost = f"{cost_minor // 100}.{cost_minor % 100:02d}"
        party = "" if duplicates + 2 <= i <= duplicates + empty + 1 else f"P{i % 257:04d}"
        yield (
            i,
            "E0000001" if 2 <= i <= duplicates + 1 else f"E{i:07d}",
            1,
            (start + timedelta(days=rng.randrange(span))).isoformat(),
            party,
            regions[i % 4],
            f"I{i % 101:04d}",
            quantity,
            unit,
            amount,
            cost,
            ("open", "closed", "void")[i % 3],
        )


def _part(archive, name, content):
    info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, content.encode())


def _row(number, values, header=False):
    cells = []
    for column, value in enumerate(values):
        at = f"{chr(65 + column)}{number}"
        numeric = not header and column in (0, 2, 7, 8, 9, 10)
        if numeric:
            cells.append(f'<c r="{at}"><v>{value}</v></c>')
        else:
            cells.append(
                f'<c r="{at}" t="inlineStr"><is><t xml:space="preserve">'
                f"{escape(str(value))}</t></is></c>"
            )
    return f'<row r="{number}">{"".join(cells)}</row>'.encode()


def file_digest(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def generate(config, output):
    output = Path(output).resolve()
    if output.is_relative_to(ROOT):
        raise ValueError("Generated data must be outside the repository")
    # Validate before creating files and never overwrite a baseline.
    iterator = iter(records(config))
    first = next(iterator)
    output.mkdir(parents=True, exist_ok=False)
    workbook = output / "table.xlsx"
    expected_rows = output / "expected-rows.jsonl"
    expectation = Expected()
    with (
        zipfile.ZipFile(
            workbook, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6
        ) as archive,
        expected_rows.open("x") as evidence,
    ):
        _part(
            archive,
            "[Content_Types].xml",
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        )
        _part(
            archive,
            "_rels/.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        )
        _part(
            archive,
            "xl/workbook.xml",
            f'<workbook xmlns="{NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Facts" sheetId="1" r:id="rId1"/></sheets></workbook>',
        )
        _part(
            archive,
            "xl/_rels/workbook.xml.rels",
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        )
        info = zipfile.ZipInfo("xl/worksheets/sheet1.xml", date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        with archive.open(info, "w", force_zip64=True) as sheet:
            sheet.write(
                f'<worksheet xmlns="{NS}"><dimension ref="A1:L{config["rows"] + 1}"/><sheetData>'.encode()
            )
            sheet.write(_row(1, COLUMNS, header=True))

            def append(values):
                sheet.write(_row(expectation.rows + 2, values))
                evidence.write(json.dumps(expectation.add(values), ensure_ascii=False) + "\n")

            append(first)
            for values in iterator:
                append(values)
            sheet.write(b"</sheetData></worksheet>")
    summary = expectation.summary()
    if summary["rows"] != config["rows"]:
        raise AssertionError("Incomplete fixture")
    if {kind: item["count"] for kind, item in summary["quality"].items()} != config["defects"]:
        raise AssertionError("Generated defect counts differ from the frozen specification")
    expected = output / "expected.json"
    expected.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    manifest = {
        "manifest_version": 1,
        "suite_id": VERSION,
        "generator_version": "1",
        "config": config,
        "logical_sha256": summary["logical_sha256"],
        "files": {
            p.name: {"bytes": p.stat().st_size, "sha256": file_digest(p)}
            for p in (workbook, expected, expected_rows)
        },
        "full_dataset": True,
        "artifact_rows": summary["rows"],
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    return manifest
