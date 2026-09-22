"""Streaming ASR shared config and utilities."""

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from voxmesh.path import ensure_streaming_paths

ensure_streaming_paths()
