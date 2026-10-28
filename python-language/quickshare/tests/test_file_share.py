import io

import pytest

from quickshare.file_share import UNCATEGORIZED, FileShare, FileShareError


def share(tmp_path, max_bytes=1024 * 1024):
    return FileShare(
        tmp_path / "uploads",
        tmp_path / "md5_cache.json",
        tmp_path / "categories.json",
        max_bytes,
    )


def test_stored_name_keeps_original_display_name(tmp_path):
    library = share(tmp_path)
    result = library.add([("a_b_c.txt", io.BytesIO(b"hello"))], "笔记")
    assert result.ok
    listed = library.list_files()
    assert listed[0].original_name == "a_b_c.txt"
    assert listed[0].name != "a_b_c.txt"
    assert listed[0].category == "笔记"
    assert listed[0].md5
    _path, download_name = library.open(listed[0].name)
    assert download_name == "a_b_c.txt"


def test_chinese_filename_is_stored_and_shown(tmp_path):
    library = share(tmp_path)
    result = library.add([("报告.pdf", io.BytesIO(b"%PDF"))])
    assert result.ok
    listed = library.list_files()[0]
    assert listed.original_name == "报告.pdf"
    assert listed.name.endswith(".pdf")
    assert "报告" not in listed.name


def test_legacy_files_without_metadata_drop_timestamp(tmp_path):
    library = share(tmp_path)
    stored = library.upload_dir / "report_1700000000.pdf"
    stored.write_bytes(b"old")
    listed = library.list_files()[0]
    assert listed.original_name == "report.pdf"
    assert listed.category == UNCATEGORIZED


def test_remove_clears_metadata_and_md5(tmp_path):
    library = share(tmp_path)
    name = library.add([("note.txt", io.BytesIO(b"abc"))]).uploaded[0]["filename"]
    library.remove(name)
    assert library.list_files() == []
    metadata = (library.upload_dir / ".file_metadata.json").read_text(encoding="utf-8")
    cache = (tmp_path / "md5_cache.json").read_text(encoding="utf-8")
    assert name not in metadata
    assert name not in cache


def test_remove_all_drops_sidecars_for_files(tmp_path):
    library = share(tmp_path)
    library.add([("one.txt", io.BytesIO(b"1")), ("two.txt", io.BytesIO(b"2"))])
    library.remove_all()
    assert library.list_files() == []
    assert (library.upload_dir / ".file_metadata.json").read_text(encoding="utf-8").strip() == "{}"


def test_oversized_file_is_not_kept(tmp_path):
    library = share(tmp_path, max_bytes=4)
    result = library.add([("big.bin", io.BytesIO(b"12345"))])
    assert not result.ok
    assert "过大" in result.failed[0]["error"]
    assert list(library.upload_dir.glob("big*")) == []


def test_category_rename_updates_files_and_blocks_delete(tmp_path):
    library = share(tmp_path)
    name = library.add([("note.txt", io.BytesIO(b"abc"))], "旧分类").uploaded[0]["filename"]
    created = library.create_category("旧分类")
    renamed = library.rename_category(created.id, "新分类")
    assert library.list_files()[0].category == "新分类"
    with pytest.raises(FileShareError, match="还有 1 个文件"):
        library.delete_category(renamed.id)
    library.set_category(name, UNCATEGORIZED)
    library.delete_category(renamed.id)
    assert library.list_categories() == []


def test_duplicate_and_default_category_names_are_rejected(tmp_path):
    library = share(tmp_path)
    library.create_category("图片")
    with pytest.raises(FileShareError, match="已存在"):
        library.create_category("图片")
    with pytest.raises(FileShareError, match="默认分类"):
        library.create_category(UNCATEGORIZED)


def test_path_escape_does_not_leave_the_upload_directory(tmp_path):
    library = share(tmp_path)
    outside = tmp_path / "secret.txt"
    outside.write_text("nope", encoding="utf-8")
    with pytest.raises(FileShareError):
        library.remove("../secret.txt")
    assert outside.exists()


def test_same_batch_gets_distinct_stored_names(tmp_path):
    library = share(tmp_path)
    result = library.add([
        ("same.txt", io.BytesIO(b"a")),
        ("same.txt", io.BytesIO(b"b")),
    ])
    names = {item["filename"] for item in result.uploaded}
    assert len(names) == 2
    assert len(library.list_files()) == 2
