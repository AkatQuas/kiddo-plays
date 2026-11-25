"""Reorder discovered insights. Statistics stay where the operators put them.

With `DATA_ANALYSIS_LLM_BASE_URL` set, an OpenAI-compatible chat endpoint receives
ids, titles, severity, and evidence fields, and returns an id order. Any
failure, or no endpoint, keeps the severity order.
"""

import json
import urllib.error
import urllib.request
from collections.abc import Callable, Sequence
from typing import Any

from data_analysis.config import settings

Transport = Callable[[Sequence[dict[str, Any]]], list[str]]


def _brief(insight: dict[str, Any]) -> dict[str, Any]:
    evidence = insight.get("evidence") if isinstance(insight.get("evidence"), dict) else {}
    caveats = evidence.get("caveats") if isinstance(evidence.get("caveats"), list) else []
    return {
        "id": insight.get("id"),
        "type": insight.get("type"),
        "title": insight.get("title"),
        "severity": insight.get("severity"),
        "evidence": {
            "operator": evidence.get("operator"),
            "method": evidence.get("method"),
            "rows_scanned": evidence.get("rows_scanned"),
            "rows_used": evidence.get("rows_used"),
            "caveats": [str(item)[:200] for item in caveats[:3]],
        },
    }


def _parse_ids(content: str) -> list[str]:
    start = content.find("[")
    end = content.rfind("]")
    if start < 0 or end < start:
        raise ValueError("LLM response has no JSON array")
    parsed = json.loads(content[start : end + 1])
    if not isinstance(parsed, list):
        raise ValueError("LLM response is not a list")
    return [str(item) for item in parsed]


def _http_rank(brief: Sequence[dict[str, Any]]) -> list[str]:
    url = settings.LLM_BASE_URL.rstrip("/") + "/chat/completions"
    body = {
        "model": settings.LLM_MODEL or "local",
        "temperature": 0,
        "messages": [
            {
                "role": "system",
                "content": (
                    "Reorder these insight ids by how urgently an analyst should look at them. "
                    "Use only the fields in the payload. Reply with a JSON array of ids and no other text."
                ),
            },
            {"role": "user", "content": json.dumps(list(brief), ensure_ascii=False)},
        ],
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
    )
    if settings.LLM_API_KEY:
        request.add_header("Authorization", "Bearer " + settings.LLM_API_KEY)
    try:
        with urllib.request.urlopen(request, timeout=settings.LLM_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError:
        raise
    except urllib.error.URLError as exc:
        raise TimeoutError("LLM endpoint unreachable") from exc
    content = payload["choices"][0]["message"]["content"]
    return _parse_ids(content)


def rank_insights(
    insights: list[dict[str, Any]],
    transport: Transport | None = None,
) -> tuple[list[dict[str, Any]], dict[str, str]]:
    ordered = sorted(insights, key=lambda item: item.get("severity") or 0.0, reverse=True)
    severity_meta = {
        "ranking_method": "severity",
        "caveat": "No LLM endpoint configured. Ranked by severity.",
    }
    if not ordered:
        return ordered, {"ranking_method": "severity", "caveat": "No insights to rank."}
    if transport is None and not settings.LLM_BASE_URL:
        return ordered, severity_meta
    try:
        brief = [_brief(item) for item in ordered]
        id_order = transport(brief) if transport is not None else _http_rank(brief)
        by_id = {item["id"]: item for item in ordered}
        ranked: list[dict[str, Any]] = []
        seen = set()
        for insight_id in id_order:
            if insight_id in by_id and insight_id not in seen:
                ranked.append(by_id[insight_id])
                seen.add(insight_id)
        for item in ordered:
            if item["id"] not in seen:
                ranked.append(item)
        if not ranked:
            raise ValueError("LLM returned no known ids")
        return ranked, {
            "ranking_method": "llm",
            "caveat": (
                "LLM reordered insight ids using titles, severity, and evidence fields. "
                "It did not recompute statistics."
            ),
        }
    except Exception as exc:
        return ordered, {
            "ranking_method": "severity",
            "caveat": f"LLM rerank failed ({type(exc).__name__}). Ranked by severity.",
        }
