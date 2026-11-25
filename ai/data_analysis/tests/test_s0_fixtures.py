"""S0 regression: deterministic files, independent expectations and real computation."""

from copy import deepcopy

import pyarrow as pa
import pytest

from data_analysis.cluster.session_manager import SessionManager
from data_analysis.connectors.excel_reader import FastExcelReader
from tests.fixtures.expected.checks import Expected
from tests.fixtures.generators.table_fixture import ROOT, generate, profile, records
from tests.fixtures.verify import read_fixture, verify_full_rows, verify_queries


def test_same_seed_produces_identical_complete_artifacts(tmp_path):
    a = generate(profile("tiny"), tmp_path / "a")
    b = generate(profile("tiny"), tmp_path / "b")
    assert a == b
    _, expected = read_fixture(tmp_path / "a")
    assert expected["rows"] == 10
    assert expected["quality"] == {
        "duplicate_extra": {"count": 1, "row_ids": [2]},
        "empty_party": {"count": 1, "row_ids": [3]},
        "amount_mismatch": {"count": 1, "row_ids": [4]},
    }


def test_reference_arithmetic_is_exact_and_not_generator_formula():
    reference = Expected()
    row = (1, "E1", 1, "2025-12-31", "P1", "R1", "I1", 3, "0.10", "0.30", "0.12", "open")
    assert reference.add(row)["issues"] == []
    wrong = (2, "E1", 1, "2026-01-01", " ", "R1", "I1", 3, "0.10", "0.31", "0.12", "open")
    assert reference.add(wrong)["issues"] == ["duplicate_extra", "empty_party", "amount_mismatch"]
    assert reference.summary()["amount_minor"] == 61
    assert reference.summary()["annual_amount_minor"] == {"2025": 30, "2026": 31}


@pytest.mark.parametrize("rows", [0, -1, True, 1_048_576])
def test_invalid_sheet_sizes_fail_before_writing(rows, tmp_path):
    config = profile("tiny")
    config["rows"] = rows
    with pytest.raises(ValueError):
        generate(config, tmp_path / "invalid")
    assert not (tmp_path / "invalid").exists()


def test_never_overwrite_or_write_generated_files_in_repository(tmp_path):
    generate(profile("tiny"), tmp_path / "original")
    with pytest.raises(FileExistsError):
        generate(profile("tiny"), tmp_path / "original")
    with pytest.raises(ValueError, match="outside"):
        generate(profile("tiny"), ROOT / "tests/generated-s0")


def test_manifest_detects_content_changes_even_when_filename_stays_same(tmp_path):
    generate(profile("tiny"), tmp_path / "fixture")
    path = tmp_path / "fixture/expected-rows.jsonl"
    path.write_text(path.read_text().replace('"row_id": 1,', '"row_id": 9,', 1))
    with pytest.raises(ValueError, match="Fixture changed"):
        read_fixture(tmp_path / "fixture")


def test_real_parser_and_sql_match_every_row_and_all_errors(tmp_path):
    generate(profile("small"), tmp_path / "fixture")
    _, expected = read_fixture(tmp_path / "fixture")
    table = FastExcelReader.read_xlsx_to_arrow(str(tmp_path / "fixture/table.xlsx"))
    verify_full_rows(table, tmp_path / "fixture", expected)
    manager = SessionManager()
    session = manager.get_or_create_session()
    try:
        session.register_dataset("facts", table)
        results = verify_queries(session.session_id, expected)
        assert results["count"]["data"] == [{"rows": 300}]
        assert expected["quality"]["duplicate_extra"]["row_ids"] == [2, 3, 4]
        assert expected["quality"]["empty_party"]["row_ids"] == [5, 6, 7, 8]
        assert expected["quality"]["amount_mismatch"]["row_ids"] == [9, 10]
    finally:
        manager.drop_session(session.session_id)


def test_unreported_fourth_row_edit_and_truncation_are_detected(tmp_path):
    generate(profile("tiny"), tmp_path / "fixture")
    _, expected = read_fixture(tmp_path / "fixture")
    table = FastExcelReader.read_xlsx_to_arrow(str(tmp_path / "fixture/table.xlsx"))
    changed = table.to_pydict()
    changed["party_code"][4] = "ACCIDENTAL_CHANGE"
    with pytest.raises(AssertionError, match="input row 5"):
        verify_full_rows(pa.table(changed), tmp_path / "fixture", expected)
    with pytest.raises(AssertionError, match="incomplete"):
        verify_full_rows(table.slice(0, 5), tmp_path / "fixture", expected)


def test_disjoint_defects_and_date_bounds():
    config = deepcopy(profile("tiny"))
    config["defects"]["empty_party"] = 9
    with pytest.raises(ValueError, match="disjoint"):
        next(records(config))
    config = profile("tiny")
    config["end_date"] = "1900-01-01"
    with pytest.raises(ValueError, match="precedes"):
        next(records(config))
