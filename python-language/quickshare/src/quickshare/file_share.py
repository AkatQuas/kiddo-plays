# -*- coding: utf-8 -*-
"""File share: stored files, display names, categories, and MD5 live in one module."""

from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from werkzeug.utils import secure_filename

UNCATEGORIZED = "未分类"
_METADATA_NAME = ".file_metadata.json"
_SAFE_SUFFIX = re.compile(r"\.[A-Za-z0-9]{1,10}")


class FileShareError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass(frozen=True)
class SharedFile:
    name: str
    original_name: str
    size: int
    size_human: str
    modified: str
    md5: str
    category: str

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "original_name": self.original_name,
            "size": self.size,
            "size_human": self.size_human,
            "modified": self.modified,
            "md5": self.md5,
            "category": self.category,
        }


@dataclass(frozen=True)
class Category:
    id: str
    name: str
    created: str
    updated: str = ""

    def as_dict(self) -> dict:
        data = {"id": self.id, "name": self.name, "created": self.created}
        if self.updated:
            data["updated"] = self.updated
        return data


@dataclass(frozen=True)
class AddResult:
    uploaded: list
    failed: list

    @property
    def ok(self) -> bool:
        return bool(self.uploaded)


class FileShare:
    def __init__(self, upload_dir: Path, md5_path: Path, categories_path: Path, max_bytes: int):
        self.upload_dir = Path(upload_dir)
        self.md5_path = Path(md5_path)
        self.categories_path = Path(categories_path)
        self.max_bytes = max_bytes
        self._lock = threading.Lock()
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def list_files(self) -> list[SharedFile]:
        with self._lock:
            files = []
            if not self.upload_dir.exists():
                return files
            for path in self.upload_dir.iterdir():
                if not path.is_file() or path.name.startswith("."):
                    continue
                files.append(self._describe(path))
        files.sort(key=lambda item: item.modified, reverse=True)
        return files

    def add(self, incoming, category: str = UNCATEGORIZED) -> AddResult:
        category = (category or "").strip() or UNCATEGORIZED
        uploaded = []
        failed = []
        with self._lock:
            for index, item in enumerate(incoming):
                filename, stream = item[0], item[1]
                if not filename:
                    failed.append({"filename": filename or "", "error": "没有选择文件"})
                    continue
                try:
                    stored = self._store(filename, stream, category, index)
                except FileShareError as exc:
                    failed.append({"filename": filename, "error": exc.message})
                else:
                    uploaded.append({"filename": stored, "original_name": filename})
        return AddResult(uploaded, failed)

    def remove(self, name: str) -> None:
        with self._lock:
            path = self._safe_path(name)
            if not path.is_file():
                raise FileShareError("文件不存在", status=404)
            path.unlink()
            metadata = self._read_json(self._metadata_path(), {})
            metadata.pop(name, None)
            self._write_json(self._metadata_path(), metadata)
            cache = self._read_json(self.md5_path, {})
            cache.pop(name, None)
            self._write_json(self.md5_path, cache)

    def remove_all(self) -> None:
        with self._lock:
            if self.upload_dir.exists():
                for path in self.upload_dir.iterdir():
                    if path.is_file() and not path.name.startswith("."):
                        path.unlink()
            self._write_json(self._metadata_path(), {})
            self._write_json(self.md5_path, {})

    def open(self, name: str) -> tuple[Path, str]:
        with self._lock:
            path = self._safe_path(name)
            if not path.is_file():
                raise FileShareError("文件不存在", status=404)
            return path, self._describe(path).original_name

    def set_category(self, name: str, category: str) -> None:
        category = (category or "").strip()
        if not category:
            raise FileShareError("分类不能为空")
        with self._lock:
            path = self._safe_path(name)
            if not path.is_file():
                raise FileShareError("文件不存在", status=404)
            metadata = self._read_json(self._metadata_path(), {})
            entry = metadata.get(name, {})
            entry["category"] = category
            metadata[name] = entry
            self._write_json(self._metadata_path(), metadata)

    def checksum(self, name: str) -> str:
        with self._lock:
            path = self._safe_path(name)
            if not path.is_file():
                raise FileShareError("文件不存在", status=404)
            digest = _md5(path)
            cache = self._read_json(self.md5_path, {})
            cache[name] = digest
            self._write_json(self.md5_path, cache)
            return digest

    def checksum_all(self) -> int:
        with self._lock:
            cache = self._read_json(self.md5_path, {})
            count = 0
            if self.upload_dir.exists():
                for path in self.upload_dir.iterdir():
                    if not path.is_file() or path.name.startswith("."):
                        continue
                    cache[path.name] = _md5(path)
                    count += 1
            self._write_json(self.md5_path, cache)
            return count

    def list_categories(self) -> list[Category]:
        with self._lock:
            return [_category_from(raw) for raw in self._read_json(self.categories_path, [])]

    def create_category(self, name: str) -> Category:
        name = (name or "").strip()
        if not name:
            raise FileShareError("分类名称不能为空")
        if name == UNCATEGORIZED:
            raise FileShareError("不能使用系统默认分类名")
        with self._lock:
            categories = self._read_json(self.categories_path, [])
            if any(item.get("name") == name for item in categories):
                raise FileShareError("分类已存在")
            category = Category(id=secrets.token_hex(4), name=name, created=_now())
            categories.append(category.as_dict())
            self._write_json(self.categories_path, categories)
            return category

    def rename_category(self, category_id: str, name: str) -> Category:
        name = (name or "").strip()
        if not name:
            raise FileShareError("分类名称不能为空")
        if name == UNCATEGORIZED:
            raise FileShareError("不能使用系统默认分类名")
        with self._lock:
            categories = self._read_json(self.categories_path, [])
            current = next((item for item in categories if item.get("id") == category_id), None)
            if current is None:
                raise FileShareError("分类不存在", status=404)
            if any(item.get("name") == name and item.get("id") != category_id for item in categories):
                raise FileShareError("分类名称已存在")
            old_name = current.get("name")
            current["name"] = name
            current["updated"] = _now()
            metadata = self._read_json(self._metadata_path(), {})
            for entry in metadata.values():
                if isinstance(entry, dict) and entry.get("category") == old_name:
                    entry["category"] = name
            self._write_json(self._metadata_path(), metadata)
            self._write_json(self.categories_path, categories)
            return _category_from(current)

    def delete_category(self, category_id: str) -> None:
        with self._lock:
            categories = self._read_json(self.categories_path, [])
            current = next((item for item in categories if item.get("id") == category_id), None)
            if current is None:
                raise FileShareError("分类不存在", status=404)
            metadata = self._read_json(self._metadata_path(), {})
            in_use = [
                name
                for name, entry in metadata.items()
                if isinstance(entry, dict) and entry.get("category") == current.get("name")
                and self._safe_path(name).is_file()
            ]
            if in_use:
                raise FileShareError(f"无法删除分类，还有 {len(in_use)} 个文件使用此分类")
            kept = [item for item in categories if item.get("id") != category_id]
            self._write_json(self.categories_path, kept)

    def _store(self, original_name: str, stream, category: str, index: int) -> str:
        stored = _stored_name(original_name, time.time_ns() + index)
        path = self._safe_path(stored)
        while path.exists():
            stored = _stored_name(original_name, time.time_ns())
            path = self._safe_path(stored)
        digest = hashlib.md5()
        written = 0
        try:
            with path.open("wb") as handle:
                while True:
                    chunk = stream.read(1024 * 1024)
                    if not chunk:
                        break
                    written += len(chunk)
                    if written > self.max_bytes:
                        raise FileShareError(f"文件过大，最大支持 {format_size(self.max_bytes)}")
                    digest.update(chunk)
                    handle.write(chunk)
        except FileShareError:
            if path.exists():
                path.unlink()
            raise
        except Exception as exc:
            if path.exists():
                path.unlink()
            raise FileShareError("保存失败") from exc
        metadata = self._read_json(self._metadata_path(), {})
        metadata[stored] = {
            "category": category,
            "original_name": original_name,
            "upload_time": _now(),
        }
        self._write_json(self._metadata_path(), metadata)
        cache = self._read_json(self.md5_path, {})
        cache[stored] = digest.hexdigest()
        self._write_json(self.md5_path, cache)
        return stored

    def _describe(self, path: Path) -> SharedFile:
        metadata = self._read_json(self._metadata_path(), {})
        entry = metadata.get(path.name, {})
        if not isinstance(entry, dict):
            entry = {}
        cache = self._read_json(self.md5_path, {})
        stat = path.stat()
        original = entry.get("original_name") or _legacy_display_name(path.name)
        return SharedFile(
            name=path.name,
            original_name=str(original),
            size=stat.st_size,
            size_human=format_size(stat.st_size),
            modified=datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
            md5=str(cache.get(path.name, "") or ""),
            category=str(entry.get("category") or UNCATEGORIZED),
        )

    def _safe_path(self, name: str) -> Path:
        if (
            not name
            or name != Path(name).name
            or name.startswith(".")
            or "/" in name
            or "\\" in name
        ):
            raise FileShareError("文件不存在", status=404)
        path = (self.upload_dir / name).resolve()
        root = self.upload_dir.resolve()
        try:
            path.relative_to(root)
        except ValueError as exc:
            raise FileShareError("文件不存在", status=404) from exc
        return path

    def _metadata_path(self) -> Path:
        return self.upload_dir / _METADATA_NAME

    @staticmethod
    def _read_json(path: Path, default):
        if not path.exists():
            return default
        try:
            with path.open(encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return default
        if isinstance(default, dict) and not isinstance(data, dict):
            return default
        if isinstance(default, list) and not isinstance(data, list):
            return default
        return data

    @staticmethod
    def _write_json(path: Path, value) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        temporary.replace(path)


def format_size(size: int) -> str:
    value = float(size)
    for unit in ("B", "KB", "MB", "GB"):
        if value < 1024.0:
            return f"{value:.1f} {unit}"
        value /= 1024.0
    return f"{value:.1f} TB"


def _stored_name(original: str, stamp: int) -> str:
    suffix = Path(original).suffix
    safe_suffix = suffix if _SAFE_SUFFIX.fullmatch(suffix) else ""
    cleaned = secure_filename(original)
    if not cleaned or cleaned in {safe_suffix, safe_suffix.lstrip(".")}:
        stem, ext = "file", safe_suffix
    else:
        stem, ext = os.path.splitext(cleaned)
        if not ext:
            ext = safe_suffix
        if not stem:
            stem = "file"
    return f"{stem}_{stamp}{ext}"


def _legacy_display_name(filename: str) -> str:
    """Old files had no stored original name. Strip a trailing timestamp when it looks like one."""
    name, ext = os.path.splitext(filename)
    if "_" not in name:
        return filename
    stem, maybe_stamp = name.rsplit("_", 1)
    if maybe_stamp.isdigit() and len(maybe_stamp) >= 10 and stem:
        return stem + ext
    return filename


def _md5(path: Path) -> str:
    digest = hashlib.md5()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _category_from(raw: dict) -> Category:
    return Category(
        id=str(raw.get("id", "")),
        name=str(raw.get("name", "")),
        created=str(raw.get("created", "")),
        updated=str(raw.get("updated", "") or ""),
    )


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
