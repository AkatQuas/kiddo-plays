# -*- coding: utf-8 -*-
from __future__ import annotations

import os
from functools import lru_cache

from agent_websearch.settings import get_settings


@lru_cache
def _load_words(path: str) -> tuple[str, ...]:
    if not path or not os.path.isfile(path):
        return ()
    with open(path, encoding="utf-8") as fh:
        return tuple(line.strip() for line in fh if line.strip())


def matched_blocklist_terms(text: str) -> list[str]:
    """Return blocklist phrases found in text. Empty path disables the check."""
    path = get_settings().sensitive_words_path
    if not path:
        return []
    words = _load_words(path)
    return [w for w in words if w and w in text]
