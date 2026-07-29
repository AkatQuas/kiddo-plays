#!/usr/bin/env python3
"""Render a GitHub repository's star history as light/dark PNG charts.

Fetches stargazer timestamps from the GitHub REST API, truncates data
before a configurable start date, and plots a cumulative "stars over time"
curve with a gradient fill beneath it.

Output files:
    assets/star-history-light.png
    assets/star-history-dark.png

Usage:
    python scripts/gen_star_history.py [--repo owner/name] [--refresh]
                                       [--start-date YYYY-MM-DD] [--out-dir DIR]

Authentication (priority order):
    1. GITHUB_TOKEN environment variable
    2. GH_TOKEN environment variable
    3. `gh auth token` (GitHub CLI)
    4. Unauthenticated (rate-limited to 60 requests/hour)

Stargazer data is cached locally to avoid repeated API calls on style
tweaks; pass --refresh to force a fresh fetch.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import matplotlib

matplotlib.use("Agg")

import matplotlib.dates as mdates
import numpy as np
from matplotlib import pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, to_rgba
from matplotlib.ticker import FuncFormatter

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_REPO = "microsoft/vscode"
DEFAULT_START_DATE = "2016-01-01"
DEFAULT_OUT_DIR = "assets"
CACHE_FILENAME = ".star-history-cache.json"
ACCENT_COLOR = "#2584e8"  # Primary accent (medium-tech blue)
API_PER_PAGE = 100
MAX_RETRIES = 4
REQUEST_TIMEOUT = 30

logger = logging.getLogger("gen_star_history")


THEMES = {
    "light": {"bg": "#f6f8fc", "text": "#192b42", "subtext": "#546886", "grid": "#d2dceb"},
    "dark":  {"bg": "#121a29", "text": "#e0ebfa", "subtext": "#8799b3", "grid": "#27364d"},
}

# ACCENT_COLOR = "#3688d8"
# THEMES = {
#     "light": {"bg": "#f7f9fc", "text": "#203048", "subtext": "#607490", "grid": "#d7e1ef"},
#     "dark":  {"bg": "#141d2c", "text": "#e4edf9", "subtext": "#8c9eb8", "grid": "#2a3a52"},
# }
#
# ACCENT_COLOR = "#1f74d1"
# THEMES = {
#     "light": {"bg": "#f4f7fc", "text": "#162840", "subtext": "#4c6282", "grid": "#cdd9eb"},
#     "dark":  {"bg": "#0f1724", "text": "#dceafc", "subtext": "#8296b4", "grid": "#23334b"},
# }
# ---------------------------------------------------------------------------
# Authentication helpers
# ---------------------------------------------------------------------------


def _resolve_token() -> Optional[str]:
    """Return a GitHub personal-access token from the environment or GitHub CLI.

    Checks ``GITHUB_TOKEN`` and ``GH_TOKEN`` environment variables before
    falling back to ``gh auth token``.  Returns ``None`` when unauthenticated.
    """
    for var in ("GITHUB_TOKEN", "GH_TOKEN"):
        if token := os.environ.get(var, "").strip():
            return token
    try:
        result = subprocess.run(
            ["gh", "auth", "token"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        pass
    logger.info("no token found — continuing unauthenticated (rate limit: 60 req/h)")
    return None


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def _request_json(url: str, headers: Dict[str, str]) -> list:
    """Fetch a JSON resource with exponential-backoff retry."""
    req = urllib.request.Request(url, headers=headers)
    last_exc: Optional[Exception] = None

    for attempt in range(MAX_RETRIES):
        try:
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
                data: list = json.load(resp)
                # The /stargazers endpoint returns a JSON array; validate shape
                # early so callers don't iterate over an unexpected type.
                if not isinstance(data, list):
                    raise ValueError(
                        f"expected JSON array, got {type(data).__name__}"
                    )
                return data
        except urllib.error.HTTPError as exc:
            if exc.code == 403 and attempt < MAX_RETRIES - 1:
                wait = 2**attempt
                logger.warning("HTTP 403 (rate limit?); retrying in %ds ...", wait)
                time.sleep(wait)
                last_exc = exc
            else:
                raise
        except (urllib.error.URLError, OSError, ValueError, json.JSONDecodeError) as exc:
            if attempt == MAX_RETRIES - 1:
                raise
            wait = 2**attempt
            logger.warning("request failed (%s); retrying in %ds ...", exc, wait)
            time.sleep(wait)
            last_exc = exc

    # Unreachable unless MAX_RETRIES == 0, but keeps the type-checker happy.
    raise RuntimeError("unreachable") from last_exc


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------


def fetch_stargazers(repo: str, cache_path: Path, refresh: bool) -> List[str]:
    """Return a sorted list of ISO-8601 UTC star timestamps.

    Results are cached at *cache_path* so that style-only re-runs don't
    hit the API.  Pass *refresh* == ``True`` to ignore the cache and
    re-fetch every page.
    """
    if cache_path.exists() and not refresh:
        logger.info("using cached stargazers from %s", cache_path)
        return json.loads(cache_path.read_text(encoding="utf-8"))

    headers = {
        "Accept": "application/vnd.github.star+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "gen-star-history/1.0",
    }
    if token := _resolve_token():
        headers["Authorization"] = f"Bearer {token}"

    starred: List[str] = []
    page = 1

    while True:
        url = (
            f"https://api.github.com/repos/{repo}/stargazers"
            f"?per_page={API_PER_PAGE}&page={page}"
        )
        data = _request_json(url, headers)
        if not data:
            break
        starred.extend(item["starred_at"] for item in data)
        logger.info("fetched %d stargazers ...", len(starred))
        page += 1

    starred.sort()
    cache_path.write_text(json.dumps(starred), encoding="utf-8")
    logger.info("cached %d stargazers to %s", len(starred), cache_path)
    return starred


# ---------------------------------------------------------------------------
# Series construction
# ---------------------------------------------------------------------------


def build_series(
    starred: List[str], start: datetime
) -> Tuple[np.ndarray, np.ndarray]:
    """Convert raw timestamps to a cumulative (x, y) plot series.

    *x* is an array of Matplotlib date numbers and *y* is the cumulative
    star count at each point.  All entries before *start* are collapsed
    into a single base value so the curve begins flush against the left
    axis edge.
    """
    if not starred:
        raise ValueError("stargazer list is empty — nothing to plot")

    times: List[datetime] = []
    for s in starred:
        dt = datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        times.append(dt)

    base = sum(1 for t in times if t < start)
    times = [t for t in times if t >= start]

    # If no stars remain after cropping, pad with the start date so
    # there is still a single visible point on the chart.
    if not times:
        logger.warning("no stargazers after %s — using an empty placeholder", start)
        x = np.array([mdates.date2num(start)])
        y = np.array([base])
        return x, y

    x = np.array(
        [mdates.date2num(start)] + [mdates.date2num(t) for t in times]
    )
    y = np.array([base] + [base + i for i in range(1, len(times) + 1)])
    return x, y


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def _draw_chart(
    x: np.ndarray,
    y: np.ndarray,
    repo: str,
    theme: Dict[str, str],
    output_path: Path,
) -> None:
    """Render a single chart variant and save it to *output_path*."""
    fig, ax = plt.subplots(figsize=(12, 6.2), dpi=200)
    fig.patch.set_facecolor(theme["bg"])
    ax.set_facecolor(theme["bg"])
    fig.subplots_adjust(left=0.075, right=0.97, top=0.80, bottom=0.10)

    y_max = y.max()
    ax.set_ylim(0, y_max * 1.10)
    x_range = x[-1] - x[0]
    ax.set_xlim(x[0], x[-1] + x_range * 0.03)

    # ---- Gradient fill under the curve --------------------------------
    r, g, b, _ = to_rgba(ACCENT_COLOR)
    fade = LinearSegmentedColormap.from_list(
        "fade", [(r, g, b, 0.0), (r, g, b, 0.35)]
    )
    gradient = np.linspace(0, 1, 256).reshape(-1, 1)
    im = ax.imshow(
        gradient,
        aspect="auto",
        cmap=fade,
        origin="lower",
        extent=[ax.get_xlim()[0], ax.get_xlim()[1], 0, ax.get_ylim()[1]],
        zorder=1,
    )
    # Clip the gradient to the area under the curve.
    xs = np.concatenate([[x[0]], x, [x[-1]]])
    ys = np.concatenate([[0.0], y, [0.0]])
    (clip_poly,) = ax.fill(xs, ys, alpha=0, zorder=1)
    im.set_clip_path(clip_poly)

    # ---- Line ---------------------------------------------------------
    # Glow underlay.
    ax.plot(x, y, color=ACCENT_COLOR, linewidth=7, alpha=0.10,
            solid_capstyle="round", zorder=2)
    # Solid line.
    ax.plot(x, y, color=ACCENT_COLOR, linewidth=2.6,
            solid_capstyle="round", zorder=3)

    # ---- Latest-value annotation --------------------------------------
    ax.scatter(
        [x[-1]], [y[-1]], s=70, color=ACCENT_COLOR,
        edgecolor=theme["bg"], linewidth=2.2, zorder=4,
    )
    ax.annotate(
        f"{int(y[-1]):,} stars",
        xy=(x[-1], y[-1]),
        xytext=(-6, 14),
        textcoords="offset points",
        ha="right",
        fontsize=16,
        fontweight="bold",
        color=theme["text"],
    )

    # ---- Titles -------------------------------------------------------
    fig.text(0.075, 0.93, "Star History", fontsize=22,
             fontweight="bold", color=theme["text"])
    fig.text(0.075, 0.862, repo, fontsize=12.5, color=theme["subtext"])

    # ---- Axes ---------------------------------------------------------
    ax.yaxis.grid(True, color=theme["grid"], linewidth=0.9,
                  linestyle=(0, (5, 4)))
    ax.set_axisbelow(True)
    for side in ("top", "right", "left"):
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_color(theme["grid"])
    ax.tick_params(axis="both", length=0, labelsize=11.5,
                   colors=theme["subtext"], pad=8)
    ax.xaxis.set_major_locator(mdates.DayLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %-d"))
    ax.yaxis.set_major_formatter(
        FuncFormatter(lambda v, _pos: f"{int(v):,}")
    )

    fig.savefig(output_path, facecolor=theme["bg"],
                bbox_inches="tight", pad_inches=0.3)
    plt.close(fig)
    logger.info("wrote %s", output_path)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        default=DEFAULT_REPO,
        help="GitHub repository in owner/name format (default: %(default)s)",
    )
    parser.add_argument(
        "--start-date",
        default=DEFAULT_START_DATE,
        help="Only include stars on or after this date, YYYY-MM-DD UTC "
             "(default: %(default)s)",
    )
    parser.add_argument(
        "--out-dir",
        default=DEFAULT_OUT_DIR,
        help="Output directory for PNG files (default: %(default)s)",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Ignore the local timestamp cache and re-fetch from the API",
    )
    return parser.parse_args(argv)


def _setup_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)s [%(name)s] %(message)s",
        stream=sys.stderr,
    )


def main(argv: Optional[List[str]] = None) -> None:
    _setup_logging()

    args = _parse_args(argv)

    # Validate --start-date format early.
    try:
        start = datetime.strptime(args.start_date, "%Y-%m-%d").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        logger.error("invalid --start-date '%s'; expected YYYY-MM-DD", args.start_date)
        sys.exit(1)

    # Resolve cache path (alongside this script).
    cache_path = Path(__file__).resolve().parent / CACHE_FILENAME

    # Fetch / load data.
    try:
        starred = fetch_stargazers(args.repo, cache_path, refresh=args.refresh)
    except Exception:
        logger.exception("failed to fetch stargazers for %s", args.repo)
        sys.exit(2)

    # Build plot series.
    try:
        x, y = build_series(starred, start)
    except ValueError as exc:
        logger.error("failed to build series: %s", exc)
        sys.exit(3)

    # Render both themes.
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    for name, theme in THEMES.items():
        output_path = out_dir / f"star-history-{name}.png"
        _draw_chart(x, y, args.repo, theme, output_path)

    logger.info("done — charts written to %s", out_dir.resolve())


if __name__ == "__main__":
    main()
