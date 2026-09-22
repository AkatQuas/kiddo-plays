"""Repository path helpers — single place for sys.path setup."""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SERVICES_ROOT = REPO_ROOT / "services"
STREAMING_ROOT = SERVICES_ROOT / "streaming_asr"
OFFLINE_ROOT = SERVICES_ROOT / "offline_asr"
WAKEUP_ROOT = SERVICES_ROOT / "wakeup"
TTS_ROOT = SERVICES_ROOT / "tts"


def _insert(path: str) -> None:
    if path not in sys.path:
        sys.path.insert(0, path)


def ensure_repo_root() -> Path:
    """Ensure repo root is on sys.path (for ``voxmesh`` imports)."""
    _insert(str(REPO_ROOT))
    return REPO_ROOT


def ensure_service_paths(service_root: Path) -> Path:
    """Ensure a service directory and repo root are on sys.path."""
    ensure_repo_root()
    _insert(str(service_root))
    return service_root


def ensure_streaming_paths() -> Path:
    """Ensure streaming_asr and repo root are on sys.path."""
    return ensure_service_paths(STREAMING_ROOT)


def ensure_offline_paths() -> Path:
    """Ensure offline_asr and repo root are on sys.path."""
    return ensure_service_paths(OFFLINE_ROOT)


def ensure_wakeup_paths() -> Path:
    """Ensure wakeup and repo root are on sys.path."""
    return ensure_service_paths(WAKEUP_ROOT)


def ensure_tts_paths() -> Path:
    """Ensure tts and repo root are on sys.path."""
    return ensure_service_paths(TTS_ROOT)
