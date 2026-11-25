import threading
import time

from pydantic import BaseModel, Field

from data_analysis.catalog.metadata_db import MetadataDB


class ColumnMeta(BaseModel):
    name: str
    data_type: str
    semantic_type: str = "DIMENSION"  # MEASURE, DIMENSION, IDENTIFIER, TEMPORAL
    description: str | None = ""
    is_primary_key: bool = False
    is_nullable: bool = True
    tags: list[str] = Field(default_factory=list)


class TableAsset(BaseModel):
    dataset_name: str
    display_name: str | None = None
    description: str | None = ""
    table_type: str = "TABLE"  # TABLE, VIEW, MARTS, STAGING
    owner: str = "admin"
    tags: list[str] = Field(default_factory=list)
    row_count: int = 0
    column_count: int = 0
    columns: list[ColumnMeta] = Field(default_factory=list)
    endorsement_status: str = "draft"  # endorsed, draft, deprecated, warning
    endorsement_note: str = ""
    endorsed_by: str | None = None
    created_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )
    updated_at: str = Field(
        default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    )


class MetaRegistry:
    """Data Catalog registry. The default ("_global") namespace is DB-backed and
    shared; a per-session namespace keeps assets in-memory and isolated so
    multiple tenants/sessions do not see each other's datasets."""

    _instance = None
    _lock = threading.RLock()
    _session_instances: dict[str, "MetaRegistry"] = {}

    def __init__(self, persistent: bool = True):
        self.persistent = persistent
        self.db = MetadataDB.get_instance() if persistent else None
        self._assets: dict[str, TableAsset] = {}

    @classmethod
    def get_instance(cls) -> "MetaRegistry":
        return get_meta_registry("_global")

    def register_table(self, asset: TableAsset) -> TableAsset:
        with self._lock:
            asset.updated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            if self.persistent:
                self.db.save_table_asset(asset.model_dump())
            else:
                self._assets[asset.dataset_name] = asset
            return asset

    def get_table(self, dataset_name: str) -> TableAsset | None:
        with self._lock:
            if self.persistent:
                data = self.db.get_table_asset(dataset_name)
                return TableAsset(**data) if data else None
            return self._assets.get(dataset_name)

    def list_tables(
        self,
        tag: str | None = None,
        keyword: str | None = None,
        endorsement_status: str | None = None,
    ) -> list[TableAsset]:
        with self._lock:
            if self.persistent:
                assets = [TableAsset(**d) for d in self.db.list_table_assets()]
            else:
                assets = list(self._assets.values())
            if tag:
                assets = [a for a in assets if tag in a.tags]
            if endorsement_status:
                assets = [
                    a
                    for a in assets
                    if (a.endorsement_status or "draft").lower() == endorsement_status.lower()
                ]
            if keyword:
                kw = keyword.lower()
                assets = [
                    a
                    for a in assets
                    if kw in a.dataset_name.lower()
                    or kw in (a.description or "").lower()
                    or kw in (a.display_name or "").lower()
                ]
            return assets

    def endorse_table(
        self,
        dataset_name: str,
        status: str = "endorsed",
        endorsement_note: str = "",
        endorsed_by: str | None = None,
    ) -> TableAsset:
        status_norm = (status or "endorsed").strip().lower()
        if status_norm not in ("endorsed", "draft", "deprecated", "warning"):
            raise ValueError(
                f"Invalid endorsement_status {status!r}; expected endorsed, draft, deprecated, or warning"
            )
        with self._lock:
            existing = self.get_table(dataset_name)
            if existing is None:
                existing = TableAsset(dataset_name=dataset_name, display_name=dataset_name)
            existing.endorsement_status = status_norm
            existing.endorsement_note = endorsement_note or ""
            existing.endorsed_by = endorsed_by
            return self.register_table(existing)

    def delete_table(self, dataset_name: str) -> bool:
        with self._lock:
            if not self.persistent:
                return self._assets.pop(dataset_name, None) is not None
            return bool(self.db and self.db.delete_table_asset(dataset_name))


def get_meta_registry(session_id: str = "_global") -> MetaRegistry:
    with MetaRegistry._lock:
        inst = MetaRegistry._session_instances.get(session_id)
        if inst is None:
            inst = MetaRegistry(persistent=(session_id == "_global"))
            MetaRegistry._session_instances[session_id] = inst
        if session_id == "_global":
            MetaRegistry._instance = inst
        return inst


def _forget_session(session_id: str) -> None:
    """Session closed / expired / evicted: its registry must not outlive it."""
    with MetaRegistry._lock:
        MetaRegistry._session_instances.pop(session_id, None)


def _register_session_cleanup() -> None:
    # Imported here: session_manager must stay importable without this module.
    from data_analysis.cluster.session_manager import SessionManager

    SessionManager.add_close_listener(_forget_session)


_register_session_cleanup()
