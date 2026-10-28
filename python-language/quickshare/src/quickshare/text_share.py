# -*- coding: utf-8 -*-
"""Text share: create, edit, and delete short notes. Edit keeps the same id."""

from __future__ import annotations

import json
import secrets
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


class TextShareError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


@dataclass(frozen=True)
class SharedText:
    id: str
    content: str
    created: str
    updated: str = ""

    def as_dict(self) -> dict:
        data = {
            "id": self.id,
            "content": self.content,
            "created": self.created,
        }
        if self.updated:
            data["updated"] = self.updated
        return data


class TextShare:
    def __init__(self, path: Path, max_content_length: int = 100_000):
        self.path = Path(path)
        self.max_content_length = max_content_length
        self._lock = threading.Lock()

    def list_texts(self) -> list[SharedText]:
        with self._lock:
            items = [_text_from(raw) for raw in self._load()]
        items.sort(key=lambda item: item.updated or item.created, reverse=True)
        return items

    def create(self, content: str) -> SharedText:
        content = self._validate(content)
        text = SharedText(
            id=secrets.token_hex(4),
            content=content,
            created=_now(),
        )
        with self._lock:
            items = self._load()
            items.append(text.as_dict())
            self._save(items)
        return text

    def get(self, text_id: str) -> SharedText:
        with self._lock:
            for raw in self._load():
                if raw.get("id") == text_id:
                    return _text_from(raw)
        raise TextShareError("文本不存在", status=404)

    def update(self, text_id: str, content: str) -> SharedText:
        content = self._validate(content)
        with self._lock:
            items = self._load()
            for raw in items:
                if raw.get("id") == text_id:
                    raw.pop("title", None)
                    raw["content"] = content
                    raw["updated"] = _now()
                    self._save(items)
                    return _text_from(raw)
        raise TextShareError("文本不存在", status=404)

    def delete(self, text_id: str) -> None:
        with self._lock:
            items = self._load()
            kept = [raw for raw in items if raw.get("id") != text_id]
            if len(kept) == len(items):
                raise TextShareError("文本不存在", status=404)
            self._save(kept)

    def clear(self) -> None:
        with self._lock:
            self._save([])

    def _validate(self, content) -> str:
        if not isinstance(content, str):
            raise TextShareError("缺少内容")
        content = content.strip()
        if not content:
            raise TextShareError("缺少内容")
        if len(content) > self.max_content_length:
            raise TextShareError(f"内容不能超过 {self.max_content_length} 个字符")
        return content

    def _load(self) -> list:
        if not self.path.exists():
            return []
        try:
            with self.path.open(encoding="utf-8") as handle:
                data = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return []
        return data if isinstance(data, list) else []

    def _save(self, items: list) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(self.path.suffix + ".tmp")
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(items, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        temporary.replace(self.path)


def _text_from(raw: dict) -> SharedText:
    return SharedText(
        id=str(raw.get("id", "")),
        content=str(raw.get("content", "")),
        created=str(raw.get("created", "")),
        updated=str(raw.get("updated", "") or ""),
    )


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
