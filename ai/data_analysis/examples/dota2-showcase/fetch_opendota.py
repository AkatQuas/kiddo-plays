"""Fetch REAL Dota 2 data from the OpenDota API (no synthetic data).

Pulls Team Spirit's recent pro matches and, for each, the per-player stats
from the match detail endpoint, then writes CSVs with the schema the analysis
expects (matches / player_matches / teams). Public API, no key required, rate
limited (~60 req/min) so we sleep between match-detail calls.

Usage:
    python fetch_opendota.py
    python fetch_opendota.py --team 7119388 --limit 40 --out data
"""

import argparse
import csv
import os
import time
from datetime import datetime, timezone
from urllib.request import urlopen, Request

API = "https://api.opendota.com/api"
SPIRIT_TEAM_ID = 7119388  # Team Spirit
_LANE_ROLE = {1: "Carry", 2: "Mid", 3: "Offlane", 4: "Support"}


def _get(path: str, retries: int = 4):
    url = f"{API}{path}"
    for attempt in range(retries):
        try:
            req = Request(url, headers={"User-Agent": "data-analysis-weekend-demo"})
            with urlopen(req, timeout=30) as r:
                import json
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001 - retry on transient/network/429
            if attempt == retries - 1:
                raise
            time.sleep(2 * (attempt + 1))
    return None


def _iso(unix_ts):
    if not unix_ts:
        return ""
    return datetime.fromtimestamp(int(unix_ts), tz=timezone.utc).date().isoformat()


def fetch(team_id: int, limit: int, out_dir: str, sleep: float = 1.2):
    os.makedirs(out_dir, exist_ok=True)
    heroes = {h["id"]: h.get("localized_name") or h.get("name") for h in _get("/heroes")}
    team = _get(f"/teams/{team_id}")
    team_name = (team or {}).get("name") or f"team_{team_id}"

    tmatches = _get(f"/teams/{team_id}/matches") or []
    tmatches = tmatches[:limit]
    print(f"{team_name}: {len(tmatches)} recent matches to fetch (detail)...")

    matches, pms = [], []
    seen_teams = {}
    for i, tm in enumerate(tmatches, 1):
        mid = tm["match_id"]
        m = _get(f"/matches/{mid}")
        if not m or not m.get("players"):
            continue
        r_name = (m.get("radiant_team") or {}).get("name") or m.get("radiant_name") or "Radiant"
        d_name = (m.get("dire_team") or {}).get("name") or m.get("dire_name") or "Dire"
        r_id = (m.get("radiant_team") or {}).get("team_id") or m.get("radiant_team_id")
        d_id = (m.get("dire_team") or {}).get("team_id") or m.get("dire_team_id")
        if r_id:
            seen_teams[r_id] = r_name
        if d_id:
            seen_teams[d_id] = d_name
        radiant_win = m.get("radiant_win")
        winner = r_name if radiant_win else d_name
        start_date = _iso(m.get("start_time"))
        duration_min = round((m.get("duration") or 0) / 60.0, 1)
        matches.append({"match_id": mid, "start_date": start_date, "duration_min": duration_min,
                        "radiant_team": r_name, "dire_team": d_name, "winner": winner,
                        "league": m.get("league", {}).get("name") if isinstance(m.get("league"), dict) else (m.get("league_name") or "")})
        for p in m["players"]:
            is_rad = p.get("isRadiant", (p.get("player_slot", 0) < 128))
            pms.append({
                "match_id": mid, "start_date": start_date,
                "account_id": p.get("account_id") or "",
                "player_name": p.get("name") or p.get("personaname") or f"acct_{p.get('account_id')}",
                "team": r_name if is_rad else d_name,
                "role": _LANE_ROLE.get(p.get("lane_role"), "Support"),
                "hero": heroes.get(p.get("hero_id"), str(p.get("hero_id"))),
                "kills": p.get("kills", 0), "deaths": p.get("deaths", 0), "assists": p.get("assists", 0),
                "gpm": p.get("gold_per_min", 0), "xpm": p.get("xp_per_min", 0),
                "last_hits": p.get("last_hits", 0),
                "win": 1 if p.get("win", 0) else 0,
            })
        if i % 5 == 0:
            print(f"  ...{i}/{len(tmatches)}")
        time.sleep(sleep)

    _write(out_dir, "matches.csv", matches)
    _write(out_dir, "player_matches.csv", pms)
    _write(out_dir, "teams.csv", [{"team_id": k, "name": v} for k, v in seen_teams.items()])

    # Record the acquisition metadata (crucially, the fetch date) so the report and
    # README can cite exactly when this real snapshot was pulled from OpenDota.
    import json
    meta = {
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "source": "OpenDota API (https://api.opendota.com)",
        "team": team_name, "team_id": team_id,
        "matches": len(matches), "player_rows": len(pms), "teams": len(seen_teams),
    }
    with open(os.path.join(out_dir, "_meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(matches)} matches, {len(pms)} player rows, {len(seen_teams)} teams -> {out_dir}")
    print(f"Fetched at: {meta['fetched_at']}")
    return meta


def _write(out_dir, name, rows):
    if not rows:
        return
    with open(os.path.join(out_dir, name), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--team", type=int, default=SPIRIT_TEAM_ID)
    ap.add_argument("--limit", type=int, default=40)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"))
    a = ap.parse_args()
    fetch(a.team, a.limit, a.out)
