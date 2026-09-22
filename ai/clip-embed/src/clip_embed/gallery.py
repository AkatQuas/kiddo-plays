import json
import logging
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class GalleryItem:
    id: str
    filename: str
    added_at: str
    metadata: dict = field(default_factory=dict)


class GalleryStore:
    """File-backed image embedding index for similarity search."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self.items: list[GalleryItem] = []
        self.embeddings = np.empty((0, 768), dtype=np.float32)
        self._load()

    def _index_path(self) -> Path:
        return self.path / "index.json"

    def _embeddings_path(self) -> Path:
        return self.path / "embeddings.npz"

    def _load(self) -> None:
        index_path = self._index_path()
        embeddings_path = self._embeddings_path()
        if not index_path.exists() or not embeddings_path.exists():
            return

        raw_items = json.loads(index_path.read_text(encoding="utf-8"))
        self.items = [GalleryItem(**item) for item in raw_items]
        data = np.load(embeddings_path)
        self.embeddings = data["embeddings"].astype(np.float32)

        if len(self.items) != len(self.embeddings):
            raise RuntimeError("Gallery index and embeddings are out of sync")

    def _save(self) -> None:
        self._index_path().write_text(
            json.dumps([asdict(item) for item in self.items], ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        np.savez_compressed(self._embeddings_path(), embeddings=self.embeddings)

    def list_items(self) -> list[GalleryItem]:
        with self._lock:
            return list(self.items)

    def add(self, filename: str, embedding: np.ndarray, image_id: str | None = None, metadata: dict | None = None) -> GalleryItem:
        vector = embedding.reshape(1, -1).astype(np.float32)
        item = GalleryItem(
            id=image_id or uuid.uuid4().hex,
            filename=filename,
            added_at=datetime.now(UTC).isoformat(),
            metadata=metadata or {},
        )

        with self._lock:
            if any(existing.id == item.id for existing in self.items):
                raise ValueError(f"image id already exists: {item.id}")

            self.items.append(item)
            self.embeddings = (
                vector if len(self.embeddings) == 0 else np.vstack([self.embeddings, vector])
            )
            self._save()

        logger.info("Added gallery image %s (%s)", item.id, item.filename)
        return item

    def remove(self, image_id: str) -> GalleryItem:
        with self._lock:
            index = next((i for i, item in enumerate(self.items) if item.id == image_id), None)
            if index is None:
                raise KeyError(image_id)

            removed = self.items.pop(index)
            self.embeddings = np.delete(self.embeddings, index, axis=0)
            self._save()
            return removed

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> list[dict]:
        with self._lock:
            if not self.items:
                return []

            query = query_embedding.reshape(1, -1).astype(np.float32)
            scores = (query @ self.embeddings.T).flatten()
            limit = min(top_k, len(self.items))
            top_indices = np.argsort(scores)[::-1][:limit]

            return [
                {
                    "id": self.items[i].id,
                    "filename": self.items[i].filename,
                    "metadata": self.items[i].metadata,
                    "similarity": round(float(scores[i]), 6),
                }
                for i in top_indices
            ]


_store: GalleryStore | None = None


def get_gallery_store() -> GalleryStore:
    global _store
    if _store is None:
        from clip_embed.config import settings

        _store = GalleryStore(settings.resolved_gallery_path)
    return _store
