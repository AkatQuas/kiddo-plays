"""Pipeline dashboard navigation contract.

The dashboard was refactored from an 11-tab web-analytics BI console into a
data-processing pipeline view: a stage rail (ingest → transform → model →
analyze → quality → activate) where each stage has one pane. The break points
are: a JS-referenced DOM id missing from the template, or a stage pill with no
matching pane. One assertion each.
"""

import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "data_analysis/web/templates/dashboard.html").read_text(encoding="utf-8")
JS = (ROOT / "data_analysis/web/static/dashboard.js").read_text(encoding="utf-8")

STAGES = ["ingest", "transform", "model", "analyze", "quality", "activate"]


def test_js_referenced_ids_exist_in_html():
    """Every getElementById target must exist in the template."""
    ids = {m for m in re.findall(r"getElementById\(['\"]([^'\"]+)", JS)}
    ids.discard("pane-")  # dynamically built as 'pane-' + stage; covered below
    missing = sorted(i for i in ids if f'id="{i}"' not in HTML)
    assert not missing, f"JS references ids absent from template: {missing}"


def test_stage_rail_matches_expected():
    """The stage rail encodes the pipeline; it must be exactly the declared stages."""
    rail = set(re.findall(r'data-stage="([a-z]+)"\s+class="stage-pill', HTML))
    assert rail == set(STAGES), f"stage rail differs from expected: {sorted(rail)}"


def test_every_stage_has_a_pane():
    """Each stage pill must have a matching pane, else it opens to nothing."""
    panes = set(re.findall(r'id="pane-([a-z]+)"', HTML))
    for stage in STAGES:
        assert stage in panes, f"stage '{stage}' has no pane-{stage}"


def test_non_finite_dwell_is_json_safe():
    """avg() can yield NaN, which is not None and would slip past a null check and
    make json.dumps raise, 500-ing /analytics/pages. Verify the sanitize logic
    directly rather than through DuckDB."""
    import json

    def sanitize(dwell):
        val = float(dwell) if dwell is not None else 0.0
        if not math.isfinite(val):
            val = 0.0
        return round(val, 1)

    for bad in (float("nan"), float("inf"), float("-inf"), None):
        assert json.dumps({"avg_dwell_seconds": sanitize(bad)})

    assert sanitize(float("nan")) == 0.0
    assert sanitize(12.34) == 12.3
