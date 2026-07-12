#!/usr/bin/env python3
"""Annotate every tsumego problem with a difficulty rating and skill domain.

Difficulty is an Elo-like prior (800..2500) that the app's adaptive
trainer then refines from real user results (lichess-style: every attempt
is a match between the user and the problem). Priors combine:
  - the source collection's known level (seed shapes are elementary,
    Gokyo Shumyo is mid, Xuanxuan Qijing harder, Igo Hatsuyoron expert);
  - solution depth (longer forced lines are harder);
  - stone count (bigger positions read slower).

Domain = which skill the problem trains. The trainer balances practice
across domains and reports per-domain strength:
  capture | ld-live | ld-kill | ko | race | connect

Usage: python3 scripts/annotate_tsumego_difficulty.py
"""

import json
from pathlib import Path

# Шкала v2 (перецентровка 2026-07-11, ТЗ-Р Р5): медиана базы ≈ 1500,
# сиды подняты к низу классики — дыра 1200–1500 закрыта; placement берёт
# границы из фактических перцентилей, не из хардкода.
SCALE_VERSION = "v2-2026-07-11"

BASE = {
    "capture": 1050,
    "life-death": 1150,
    "gokyo-shumyo": 1140,
    "xuanxuan-qijing": 1390,
    "igo-hatsuyoron": 1740,
}

SECTION_TWEAK = {
    "technique": 200,      # seed capture techniques
    "side": 100,           # seed side L&D reads harder than corner
    "killing": 50,
    "ko": 150,
    "capturing-race": 100,
    "oiotoshi": 100,
}

DOMAIN_BY_SECTION = {
    # seed
    "atari": "capture",
    "technique": "capture",
    # gokyo
    "living": "ld-live",
    "killing": "ld-kill",
    "ko": "ko",
    "capturing-race": "race",
    "oiotoshi": "capture",
    "connecting": "connect",
    "various": "ld-live",
}

DOMAIN_LABELS = {
    "capture": "Захват камней",
    "ld-live": "Жизнь группы",
    "ld-kill": "Убийство группы",
    "ko": "Ко",
    "race": "Гонка захвата",
    "connect": "Соединение",
}


def main_line_depth(tree):
    """Solver moves on the deepest correct line."""
    best = 0
    for node in tree or []:
        if node.get("tag") == "wrong":
            continue
        depth, cur = 1, node
        while cur.get("children"):
            cur = cur["children"][0]
            depth += 1
        best = max(best, (depth + 1) // 2)  # solver plays odd plies
    return best


THEME_DOMAIN = {
    "live": "ld-live", "kill": "ld-kill", "play-inside": "ld-kill",
    "ko": "ko", "capturing-race": "race", "connect-under": "connect",
    "net": "capture", "oiotoshi": "capture", "wedge": "connect",
    "escape": "race",
}


def domain_of(problem):
    # Per-problem theme (e.g. Hatsuyoron 1982-index re-tag) is authoritative.
    theme = problem.get("theme")
    if theme in THEME_DOMAIN:
        return THEME_DOMAIN[theme]
    sec = problem["section"]
    if sec in DOMAIN_BY_SECTION:
        return DOMAIN_BY_SECTION[sec]
    if problem["category"] == "life-death" or problem["category"] in (
        "xuanxuan-qijing", "igo-hatsuyoron",
    ):
        # Seed corner/side problems and classical positions: killing when
        # the mover attacks (title/kill ids), living otherwise.
        if "kill" in problem["id"]:
            return "ld-kill"
        return "ld-live"
    return "ld-live"


def stones_in_view(problem):
    """Камни в пределах view (термин размера позиции). Для задач без view —
    вся доска (сиды 9×9)."""
    v = problem.get("view")
    size = problem.get("size") or 9
    n = 0
    for i, ch in enumerate(problem["board"]):
        if ch == ".":
            continue
        if v:
            c, r = i % size, i // size
            if not (v["c0"] <= c <= v["c1"] and v["r0"] <= r <= v["r1"]):
                continue
        n += 1
    return n


def difficulty_of(problem):
    base = BASE.get(problem["category"], 1200)
    base += SECTION_TWEAK.get(problem["section"], 0)
    depth = main_line_depth(problem.get("tree"))
    if depth:
        base += (depth - 1) * 60
    base += max(0, stones_in_view(problem) - 8) * 8
    return max(800, min(2500, base))


def main():
    for path in [Path("data/tsumego/problems.json"),
                 Path("apps/mobile/src/data/tsumego.json")]:
        db = json.loads(path.read_text(encoding="utf-8"))
        for p in db["problems"]:
            # Домены xuanxuan/hatsuyoron размечает Р1-классификатор
            # (redomain_tsumego.py) — их не перетирать дефолтом.
            if "domain_legacy" not in p:
                p["domain"] = domain_of(p)
            p["difficulty"] = difficulty_of(p)
        db["domains"] = DOMAIN_LABELS
        db["scaleVersion"] = SCALE_VERSION
        path.write_text(json.dumps(db, ensure_ascii=False, indent=1),
                        encoding="utf-8")
    marked = [p for p in db["problems"] if p.get("tree")]
    by_domain = {}
    for p in marked:
        by_domain.setdefault(p["domain"], []).append(p["difficulty"])
    for d, vals in sorted(by_domain.items()):
        print(f"{d:10s} marked={len(vals):3d} difficulty {min(vals)}–{max(vals)}")
    ds = sorted(p["difficulty"] for p in db["problems"])
    pct = lambda q: ds[int(q * len(ds))]  # noqa: E731
    # Placement-границы приложение читает из данных, не из хардкода (Д6).
    meta = {
        "scaleVersion": SCALE_VERSION,
        "min": ds[0], "p10": pct(.10), "median": pct(.50),
        "p90": pct(.90), "max": ds[-1],
    }
    Path("apps/mobile/src/data/scaleMeta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"шкала {SCALE_VERSION}: min {ds[0]} p10 {pct(.10)} медиана {pct(.50)} "
          f"p90 {pct(.90)} max {ds[-1]}  -> scaleMeta.json")
    print(f"annotated {len(db['problems'])} problems")


if __name__ == "__main__":
    main()
