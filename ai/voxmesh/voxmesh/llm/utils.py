from __future__ import annotations

import re


def calculate_edit_distance(s1: str, s2: str) -> int:
    if not s1 and not s2:
        return 0
    if not s1:
        return len(s2)
    if not s2:
        return len(s1)

    rows, cols = len(s1) + 1, len(s2) + 1
    dist = [[0 for _ in range(cols)] for _ in range(rows)]

    for i in range(rows):
        dist[i][0] = i
    for j in range(cols):
        dist[0][j] = j

    for i in range(1, rows):
        for j in range(1, cols):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            dist[i][j] = min(
                dist[i - 1][j] + 1,
                dist[i][j - 1] + 1,
                dist[i - 1][j - 1] + cost,
            )

    return dist[rows - 1][cols - 1]


def has_consecutive_repeated_chars(text: str) -> bool:
    if not text:
        return False
    return bool(re.findall(r"(.)\1+", text))
