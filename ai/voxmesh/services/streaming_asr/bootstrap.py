"""Import this module first in streaming entry points."""

import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from voxmesh.path import ensure_streaming_paths

ensure_streaming_paths()
