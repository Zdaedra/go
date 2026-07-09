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

BASE = {
    "capture": 850,
    "life-death": 1050,
    "gokyo-shumyo": 1500,
    "xuanxuan-qijing": 1750,
    "igo-hatsuyoron": 2100,
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


def domain_of(problem):
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


def difficulty_of(problem):
    base = BASE.get(problem["category"], 1200)
    base += SECTION_TWEAK.get(problem["section"], 0)
    depth = main_line_depth(problem.get("tree"))
    if depth:
        base += (depth - 1) * 60
    stones = sum(1 for ch in problem["board"] if ch != ".")
    base += max(0, stones - 8) * 8
    return max(800, min(2500, base))


def main():
    for path in [Path("data/tsumego/problems.json"),
                 Path("apps/mobile/src/data/tsumego.json")]:
        db = json.loads(path.read_text(encoding="utf-8"))
        for p in db["problems"]:
            p["domain"] = domain_of(p)
            p["difficulty"] = difficulty_of(p)
        db["domains"] = DOMAIN_LABELS
        path.write_text(json.dumps(db, ensure_ascii=False, indent=1),
                        encoding="utf-8")
    marked = [p for p in db["problems"] if p.get("tree")]
    by_domain = {}
    for p in marked:
        by_domain.setdefault(p["domain"], []).append(p["difficulty"])
    for d, vals in sorted(by_domain.items()):
        print(f"{d:10s} marked={len(vals):3d} difficulty {min(vals)}–{max(vals)}")
    print(f"annotated {len(db['problems'])} problems")


if __name__ == "__main__":
    main()
