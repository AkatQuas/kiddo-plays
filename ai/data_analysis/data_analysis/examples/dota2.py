"""Built-in Dota 2 example: in-memory sample + analysis + tactical guidance.

Single source of truth for the Dota2 demo (web endpoint + CLI). Generates an
OpenDota-shaped season, lands it in a session, and drives SQL/OLAP + correlation
+ KMeans clustering + Insight Copilot, then derives rule-based tactical guidance.
"""

import os
import random
from typing import Any, Dict, List

import pandas as pd

from data_analysis.cluster.session_manager import SessionManager

EXAMPLE_ID = "dota2"
NAME = "Dota 2 team scouting (Team Spirit)"
DOMAIN = "Esports · Dota 2 (OpenDota)"
DESCRIPTION = "Spirit-focused scouting: sides, opponents, tempo, signatures, win factors, notes"

# The analysis subject: everything is framed around this team so the report is a
# focused scouting report rather than a meaningless league-wide winrate table
# (opponents only appear a few times in a team-centric pull -> small-sample noise).
FOCUS_TEAM = "Team Spirit"

# Real data fetched from the OpenDota API (see examples/dota2-analysis/fetch_opendota.py),
# bundled in the repo. run_in_memory loads this by default; the synthetic generator
# below is only an offline fallback if the real CSVs are absent.
REAL_DATA_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "examples", "dota2-showcase", "data")
)

# Xtreme Gaming (XG) is a real top-tier team; included as the strongest sample
# team so it stands out in the report. See README for pulling real XG data from
# the OpenDota /teams/{team_id} endpoints.
_TEAMS = [("Xtreme Gaming", 0.75), ("Team Alpha", 0.72), ("Team Bravo", 0.66), ("Team Cobra", 0.58),
          ("Team Delta", 0.52), ("Team Echo", 0.47), ("Team Falcon", 0.42), ("Team Ghost", 0.36),
          ("Team Hydra", 0.30)]
_ROLES = ["Carry", "Mid", "Offlane", "Support", "HardSupport"]
_HEROES = {
    "Carry": ["Faceless Void", "Juggernaut", "Phantom Assassin", "Terrorblade", "Spectre", "Medusa"],
    "Mid": ["Invoker", "Storm Spirit", "Puck", "Queen of Pain", "Ember Spirit", "Lina"],
    "Offlane": ["Mars", "Tidehunter", "Centaur", "Underlord", "Axe", "Beastmaster"],
    "Support": ["Crystal Maiden", "Rubick", "Jakiro", "Lion", "Shadow Shaman"],
    "HardSupport": ["Dazzle", "Warlock", "Treant Protector", "Witch Doctor", "Io"],
}


def generate_frames(seed: int = 7, n_matches: int = 160) -> Dict[str, pd.DataFrame]:
    from datetime import date, timedelta
    rng = random.Random(seed)
    teams, players, meta = [], [], {}
    for tid, (tname, skill) in enumerate(_TEAMS, start=1):
        style = "tempo" if tid % 2 == 1 else "scaling"
        teams.append({"team_id": tid, "name": tname, "skill": skill, "style": style})
        meta[tname] = {"skill": skill, "style": style, "players": []}
        for r_idx, role in enumerate(_ROLES):
            pool_size = 2 if (tid + r_idx) % 4 == 0 else rng.randint(3, 4)
            pool = rng.sample(_HEROES[role], pool_size)
            p = {"account_id": tid * 100 + r_idx, "player_name": f"{tname.split()[1][:3]}_{role[:3]}",
                 "team": tname, "role": role, "hero_pool": "|".join(pool),
                 "skill": round(min(0.95, skill + rng.uniform(-0.05, 0.08)), 3)}
            players.append(p)
            meta[tname]["players"].append(p)

    start = date(2025, 1, 1)
    names = [t["name"] for t in teams]
    matches, pms = [], []
    for mid in range(1, n_matches + 1):
        a, b = rng.sample(names, 2)
        sa, sb = meta[a]["skill"], meta[b]["skill"]
        winner = a if rng.random() < sa / (sa + sb) else b
        base = 28 if meta[winner]["style"] == "tempo" else 44
        duration = max(18, round(rng.gauss(base, 6), 1))
        mdate = (start + timedelta(days=rng.randint(0, 250))).isoformat()
        matches.append({"match_id": 7_000_000_000 + mid, "start_date": mdate, "duration_min": duration,
                        "radiant_team": a, "dire_team": b, "winner": winner, "league": "Sample Pro League S1"})
        for tname in (a, b):
            won = tname == winner
            for p in meta[tname]["players"]:
                s = _stats(rng, p["role"], p["skill"], won)
                pms.append({"match_id": 7_000_000_000 + mid, "start_date": mdate,
                            "account_id": p["account_id"], "player_name": p["player_name"],
                            "team": tname, "role": p["role"], "hero": rng.choice(p["hero_pool"].split("|")),
                            "kills": s["k"], "deaths": s["d"], "assists": s["a"],
                            "gpm": s["gpm"], "xpm": s["xpm"], "last_hits": s["lh"],
                            "win": 1 if won else 0})
    return {"matches": pd.DataFrame(matches), "player_matches": pd.DataFrame(pms),
            "players": pd.DataFrame(players),
            "teams": pd.DataFrame([{k: t[k] for k in ("team_id", "name", "skill", "style")} for t in teams])}


def _stats(rng, role, skill, won):
    wb = 1.15 if won else 0.9
    table = {
        "Carry": (620, 280, 9, 5, 9), "Mid": (580, 230, 10, 6, 11), "Offlane": (450, 150, 6, 7, 15),
        "Support": (320, 60, 4, 8, 18), "HardSupport": (280, 40, 3, 9, 20),
    }
    g, lh, k, d, a = table[role]
    gpm = max(150, round(rng.gauss(g * skill * wb, 55)))
    return {"gpm": gpm, "xpm": max(150, round(gpm * rng.uniform(0.9, 1.1))),
            "lh": max(10, round(rng.gauss(lh * (wb if role in ("Carry", "Mid", "Offlane") else 1), 30))),
            "k": max(0, round(rng.gauss(k, 3))), "d": max(1, round(rng.gauss(d, 2))),
            "a": max(0, round(rng.gauss(a, 4)))}


def register_frames(con, frames):
    for name in ("matches", "player_matches", "players", "teams"):
        con.register(f"_src_{name}", frames[name])
        con.execute(f"CREATE OR REPLACE TABLE {name} AS SELECT * FROM _src_{name}")
        con.unregister(f"_src_{name}")


def analyze(session_id: str, con, data_note: str = None, focus: str = FOCUS_TEAM) -> Dict[str, Any]:
    def q(sql, params=None):
        cur = con.execute(sql, params) if params else con.execute(sql)
        return cur.df().to_dict("records")

    def _wr(rows):  # add winrate% from games/wins
        for r in rows:
            r["winrate"] = round(100.0 * r["wins"] / r["games"], 1) if r["games"] else 0.0
        return rows

    overall = q("""SELECT count(*) games, sum(CASE WHEN winner=? THEN 1 ELSE 0 END) wins,
                          round(avg(duration_min),1) avg_dur
                   FROM matches WHERE radiant_team=? OR dire_team=?""", [focus, focus, focus])[0]
    xg_games = int(overall["games"] or 0)
    xg_winrate = round(100.0 * (overall["wins"] or 0) / xg_games, 1) if xg_games else 0.0

    sides = _wr(q("""SELECT CASE WHEN radiant_team=? THEN 'Radiant (天辉)' ELSE 'Dire (夜魇)' END side,
                            count(*) games, sum(CASE WHEN winner=? THEN 1 ELSE 0 END) wins
                     FROM matches WHERE radiant_team=? OR dire_team=? GROUP BY 1 ORDER BY 1""",
                  [focus, focus, focus, focus]))
    opponents = _wr(q("""SELECT CASE WHEN radiant_team=? THEN dire_team ELSE radiant_team END opponent,
                                count(*) games, sum(CASE WHEN winner=? THEN 1 ELSE 0 END) wins
                         FROM matches WHERE radiant_team=? OR dire_team=?
                         GROUP BY 1 ORDER BY games DESC, wins DESC""", [focus, focus, focus, focus]))
    tempo = _wr(q("""SELECT CASE WHEN duration_min<35 THEN '短局 (<35min)' ELSE '长局 (>=35min)' END bucket,
                            count(*) games, sum(CASE WHEN winner=? THEN 1 ELSE 0 END) wins,
                            round(avg(duration_min),1) avg_dur
                     FROM matches WHERE radiant_team=? OR dire_team=? GROUP BY 1 ORDER BY 1""",
                  [focus, focus, focus]))
    players = q("""SELECT player_name, role, count(*) games,
                          round((avg(kills)+avg(assists))/greatest(avg(deaths),1),2) kda,
                          round(avg(kills),1) k, round(avg(deaths),1) d, round(avg(assists),1) a,
                          round(avg(gpm)) gpm, round(avg(xpm)) xpm, round(avg(last_hits)) lh,
                          count(DISTINCT hero) hero_pool, round(avg(win)*100,1) winrate
                   FROM player_matches WHERE team=? GROUP BY player_name, role
                   ORDER BY gpm DESC""", [focus])
    signatures = q("""SELECT player_name, hero, count(*) games, round(avg(win)*100,1) winrate,
                             round((avg(kills)+avg(assists))/greatest(avg(deaths),1),2) kda
                      FROM player_matches WHERE team=? GROUP BY player_name, hero
                      HAVING count(*)>=3 ORDER BY player_name, games DESC""", [focus])
    hero_pref = q("""SELECT hero, count(*) picks, round(avg(win)*100,1) winrate
                     FROM player_matches WHERE team=? GROUP BY hero HAVING count(*)>=3
                     ORDER BY picks DESC LIMIT 12""", [focus])
    wc = q("""SELECT round(corr(gpm,win),3) gpm, round(corr(xpm,win),3) xpm,
                     round(corr(kills,win),3) kills, round(corr(deaths,win),3) deaths,
                     round(corr(assists,win),3) assists, round(corr(last_hits,win),3) last_hits
              FROM player_matches WHERE team=?""", [focus])[0]

    n_teams = int(q("SELECT count(DISTINCT team) c FROM player_matches")[0]["c"])
    n_players = int(q("SELECT count(DISTINCT player_name) c FROM player_matches")[0]["c"])

    guidance = _tactics(focus, xg_winrate, sides, tempo, opponents, players, hero_pref, wc)
    report = _report(focus, xg_games, xg_winrate, overall, sides, opponents, tempo,
                     players, signatures, hero_pref, wc, guidance, data_note)
    return {"example_id": EXAMPLE_ID, "name": NAME, "domain": DOMAIN,
            "session_id": session_id, "dataset_name": "player_matches",
            "focus_team": focus, "focus_games": xg_games, "focus_winrate": xg_winrate,
            "teams": n_teams, "players": n_players,
            "data_note": data_note, "report_markdown": report}


def _read_meta(data_dir: str):
    import json
    path = os.path.join(data_dir, "_meta.json")
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (ValueError, OSError):
        return None


def data_note_from_meta(meta) -> str:
    if meta:
        return (
            f"Source: {meta.get('source', 'OpenDota API')} · Team: {meta.get('team', FOCUS_TEAM)} "
            f"(team_id={meta.get('team_id')}) · fetched_at: {meta.get('fetched_at', 'unknown')}"
        )
    return "Source: synthetic fallback (no local OpenDota CSVs; run examples/dota2-showcase/fetch_opendota.py)"


def _load_real_tables(con) -> bool:
    """Load the bundled real OpenDota CSVs into the session. Returns False if absent."""
    if not os.path.exists(os.path.join(REAL_DATA_DIR, "player_matches.csv")):
        return False
    for tbl in ("matches", "player_matches", "teams"):
        path = os.path.join(REAL_DATA_DIR, f"{tbl}.csv")
        if not os.path.exists(path):
            continue
        df = pd.read_csv(path)
        con.register(f"_src_{tbl}", df)
        con.execute(f"CREATE OR REPLACE TABLE {tbl} AS SELECT * FROM _src_{tbl}")
        con.unregister(f"_src_{tbl}")
    return True


def run_in_memory(session_id: str = None, seed: int = 7) -> Dict[str, Any]:
    sess = SessionManager().get_or_create_session(session_id)
    con = sess.get_duckdb_conn()
    if _load_real_tables(con):
        note = data_note_from_meta(_read_meta(REAL_DATA_DIR))
    else:  # offline fallback only
        register_frames(con, generate_frames(seed))
        note = data_note_from_meta(None)
    return analyze(sess.session_id, con, data_note=note)


_CORR_LABEL = {"gpm": "经济(GPM)", "xpm": "经验(XPM)", "kills": "击杀", "deaths": "死亡",
               "assists": "助攻", "last_hits": "正补"}


def _f(n):
    try:
        return f"{float(n):,.1f}" if isinstance(n, float) else f"{n}"
    except (TypeError, ValueError):
        return str(n)


def _table(rows, cols, headers=None):
    head = headers or cols
    out = ["| " + " | ".join(head) + " |", "|" + "|".join(["---"] * len(head)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(_f(r.get(c)) for c in cols) + " |")
    return out


def _best_side(sides):
    return max(sides, key=lambda s: s["winrate"]) if sides else None


def _tactics(focus, winrate, sides, tempo, opponents, players, hero_pref, wc) -> List[str]:
    g = []
    # Side preference
    if len(sides) == 2:
        hi, lo = max(sides, key=lambda s: s["winrate"]), min(sides, key=lambda s: s["winrate"])
        if hi["winrate"] - lo["winrate"] >= 10:
            g.append(f"**分边**：{focus} 在 {hi['side']} 胜率 {hi['winrate']}% 明显高于 {lo['side']} {lo['winrate']}%——BP 阶段争夺其弱势边（{lo['side']}）或抢其强势边。")
    # Tempo
    if len(tempo) == 2:
        short = next((t for t in tempo if t["bucket"].startswith("短")), None)
        long = next((t for t in tempo if t["bucket"].startswith("长")), None)
        if short and long:
            if short["winrate"] > long["winrate"] + 5:
                g.append(f"**节奏**：{focus} 是**前期节奏队**（短局胜率 {short['winrate']}% > 长局 {long['winrate']}%）——稳住前中期、拖入后期可降低其胜率。")
            elif long["winrate"] > short["winrate"] + 5:
                g.append(f"**节奏**：{focus} 是**后期发育队**（长局胜率 {long['winrate']}% > 短局 {short['winrate']}%）——前期主动压制、速推逼团、别让其舒服发育。")
    # Ban targets: high pick + high winrate signature heroes
    bans = sorted([h for h in hero_pref if h["winrate"] >= 55], key=lambda h: (h["picks"], h["winrate"]), reverse=True)[:4]
    if bans:
        g.append("**Ban 目标**：优先 ban 其高频高胜英雄 → " + "；".join(f"{b['hero']}（{b['picks']}次/{b['winrate']}%）" for b in bans) + "。")
    # Key threat players
    if players:
        core = sorted(players, key=lambda p: p["gpm"], reverse=True)[0]
        pk = sorted(players, key=lambda p: p["kda"], reverse=True)[0]
        g.append(f"**核心威胁**：Carry 经济核心 **{core['player_name']}**（{core['role']}, GPM {core['gpm']}, 胜率 {core['winrate']}%）——针对其发育路线 gank/封野；团战核心 **{pk['player_name']}**（KDA {pk['kda']}）优先集火/切入。")
    # Win factor from correlations (exclude near-1 trivial pairs by design: these are vs win)
    factors = {k: v for k, v in wc.items() if v is not None}
    if factors:
        top = max(factors.items(), key=lambda kv: abs(kv[1]))
        low_death = factors.get("deaths")
        msg = f"**制胜因子**：{focus} 胜负与「{_CORR_LABEL.get(top[0], top[0])}」相关性最高（r={top[1]}）"
        if low_death is not None and low_death <= -0.3:
            msg += f"；死亡数与胜负负相关（r={low_death}）——通过多线牵制、抓落单制造其死亡即可有效降低其胜率"
        g.append(msg + "。")
    return g


def _report(focus, xg_games, xg_winrate, overall, sides, opponents, tempo,
            players, signatures, hero_pref, wc, guidance, data_note=None) -> str:
    L = [f"# Dota 2 战队深度分析报告 · {focus}\n",
         "> 由 data-analysis-service 端到端生成（SQL/OLAP · 分边/节奏/对阵 · 选手签名英雄 · 制胜因子相关 · 战术指导）。数据结构对齐 OpenDota。"]
    if data_note:
        L.append(f"> {data_note}")
    L.append("")

    L.append("## 1. XG 战绩概览")
    L.append(f"- 样本对局：**{xg_games}** 场 · 胜率 **{xg_winrate}%** · 平均时长 **{overall.get('avg_dur')} min**")
    L.append("")
    L.append("**天辉 / 夜魇 分边胜率**")
    L += _table(sides, ["side", "games", "wins", "winrate"], ["分边", "场次", "胜", "胜率%"])
    L.append("")

    L.append("## 2. 对阵各对手战绩")
    L += _table(opponents[:12], ["opponent", "games", "wins", "winrate"], ["对手", "场次", "胜", "胜率%"])
    L.append("")

    L.append("## 3. 节奏画像（时长 ↔ 胜负）")
    L += _table(tempo, ["bucket", "games", "wins", "winrate", "avg_dur"], ["局长分档", "场次", "胜", "胜率%", "均时长"])
    L.append("")

    L.append("## 4. XG 选手数据（经验与效率）")
    L += _table(players, ["player_name", "role", "games", "kda", "gpm", "xpm", "lh", "hero_pool", "winrate"],
                ["选手", "位置", "场次", "KDA", "GPM", "XPM", "正补", "英雄池", "胜率%"])
    L.append("")

    L.append("## 5. 选手签名英雄（≥3 场，按使用次数）")
    by_player = {}
    for s in signatures:
        by_player.setdefault(s["player_name"], []).append(s)
    for name, rows in by_player.items():
        top = sorted(rows, key=lambda x: x["games"], reverse=True)[:4]
        L.append(f"- **{name}**：" + "，".join(f"{r['hero']}（{r['games']}场/{r['winrate']}%胜/KDA{r['kda']}）" for r in top))
    L.append("")

    L.append("## 6. XG 英雄偏好（Top，含该英雄胜率）")
    L += _table(hero_pref, ["hero", "picks", "winrate"], ["英雄", "使用次数", "胜率%"])
    L.append("")

    L.append("## 7. 制胜因子：各项数据与胜负的相关性")
    L.append("> 相关系数越大表示该项越能区分 XG 的胜负（区别于「GPM↔XPM」这类恒相关的废话指标）。")
    order = sorted([(k, v) for k, v in wc.items() if v is not None], key=lambda kv: abs(kv[1]), reverse=True)
    for k, v in order:
        L.append(f"- {_CORR_LABEL.get(k, k)}：r = **{v}**")
    L.append("")

    L.append("## 8. 战术指导（如何打 XG）")
    for item in guidance:
        L.append(f"- {item}")
    L.append("")
    return "\n".join(L) + "\n"
