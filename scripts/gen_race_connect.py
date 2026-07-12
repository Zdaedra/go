#!/usr/bin/env python3
"""Connect + race via the capture solver — NEGATIVE RESULT, output not shipped.

Tried to generate connect/race by reusing gen_tsumego.build_capture_problem
(the certified capture solver) with connect/race MOTIF templates. Outcome:
`cut-atari` produced 196 boards IDENTICAL to plain capture ataris — the
solver certifies "a white stone is captured", which for these motifs is just
a relabelled atari, not a distinct skill. Only `cut-net` (8, a real net tesuji)
and `race-corner` (8) were genuinely distinct; too few to ship.

Lesson (same as Р1b): connect/race bottom out in capture, so a capture oracle
can't separate them from the capture domain. Honest connect/race need a
DISTINCT-SKILL oracle on the KataGo crop: connect = "after the move white
cannot CUT (can't capture either black group)"; race = "black WINS the semeai
(captures white AND its own group survives)". That is a separate build, like
the ld pipeline. Kept as documentation of the dead end.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gen_tsumego import (  # noqa: E402
    N, build_capture_problem, _place, _cr, _idx, idx_to_coord, render,
)

# id, section, white(target/cutter), black(attacker), depth, base_difficulty
CONNECT_TEMPLATES = [
    # white cutting stone(s) between black groups; capturing links the groups
    ("cut-atari", "cut", ["ec"], ["dc", "fc", "eb"], 1, 1080),
    ("cut-side", "cut", ["eb"], ["db", "fb", "ec"], 1, 1050),
    ("cut-two", "cut", ["ec", "fc"],
     ["dc", "eb", "fb", "gc", "ed", "fd"], 1, 1180),
    ("cut-ladder", "cut", ["ed"], ["ec", "dd"], 7, 1260),
    ("cut-net", "cut", ["ee"], ["de", "ed", "fd", "ff"], 3, 1300),
]

RACE_TEMPLATES = [
    # capturing races / oiotoshi — filling the right liberty first is the key
    ("race-approach", "semeai", ["fb", "fc"],
     ["eb", "ec", "ed", "gc", "gd", "fe"], 3, 1320),
    ("oiotoshi", "semeai", ["dc", "ec"],
     ["db", "eb", "cc", "fc", "dd", "ed", "fb"], 3, 1380),
    ("race-corner", "semeai", ["ba", "bb"],
     ["ca", "cb", "cc", "bc", "ac"], 3, 1300),
    ("race-2v2", "semeai", ["ee", "fe"],
     ["ed", "fd", "ge", "de", "ef", "ff"], 4, 1400),
]


def generate(templates, domain):
    seen = set()
    out = []
    for tid, section, w_rel, b_rel, depth, base in templates:
        w_cr = [_cr(c) for c in w_rel]
        b_cr = [_cr(c) for c in b_rel]
        made = 0
        for sym in range(8):
            for dy in range(-N, N):
                for dx in range(-N, N):
                    wp = _place(w_cr, sym, dx, dy)
                    bp = _place(b_cr, sym, dx, dy)
                    if wp is None or bp is None:
                        continue
                    board = ["."] * (N * N)
                    ok = True
                    for (c, r) in wp:
                        if board[_idx(c, r)] != ".":
                            ok = False
                            break
                        board[_idx(c, r)] = "w"
                    for (c, r) in bp:
                        if not ok or board[_idx(c, r)] != ".":
                            ok = False
                            break
                        board[_idx(c, r)] = "b"
                    if not ok:
                        continue
                    key = "".join(board)
                    if key in seen:
                        continue
                    prob = build_capture_problem(board, "b", depth)
                    if prob is None:
                        continue
                    seen.add(key)
                    diff = base + (prob["pv_len"] - 1) * 30
                    prob.update({"template": tid, "section": section,
                                 "domain": domain, "difficulty": diff})
                    out.append(prob)
                    made += 1
        print(f"  {tid:14s} -> {made} certified")
    return out


TITLE = {"connect": "Соединение", "race": "Гонка свобод"}
CAT = {"connect": ("connect", "Соединение", [{"id": "cut", "title": "Разрез"}]),
       "race": ("race", "Гонка свобод",
                [{"id": "semeai", "title": "Семеай"}])}


def emit(probs, domain):
    cat_id, cat_title, sections = CAT[domain]
    records, cnt = [], {}
    for p in probs:
        cnt[p["template"]] = cnt.get(p["template"], 0) + 1
        records.append({
            "id": f"gen-{domain}-{p['template']}-{cnt[p['template']]:03d}",
            "category": cat_id, "section": p["section"], "title": TITLE[domain],
            "to_move": p["to_move"], "size": N, "board": p["board"],
            "domain": domain, "difficulty": p["difficulty"], "tree": p["tree"],
            "scaleVersion": "v2-2026-07-11",
            "marked_by": {"engine": "gen+negamax-solver", "template": p["template"]},
        })
    path = Path(__file__).resolve().parent.parent / \
        f"data/tsumego/generated/{domain}.json"
    path.write_text(json.dumps({
        "board_size": N,
        "source": "procedurally generated, capture-solver-certified",
        "categories": [{"id": cat_id, "title": cat_title, "sections": sections}],
        "problems": records,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    return records, path


if __name__ == "__main__":
    for domain, templates in (("connect", CONNECT_TEMPLATES),
                              ("race", RACE_TEMPLATES)):
        print(f"=== {domain} ===")
        probs = generate(templates, domain)
        recs, path = emit(probs, domain)
        print(f"emitted {len(recs)} -> {path}")
        shown = set()
        for p in probs:
            if p["template"] in shown:
                continue
            shown.add(p["template"])
            key = next((n["at"] for n in p["tree"]
                        if n.get("tag") == "correct" or n.get("children")), "?")
            print(f"[{p['template']}] diff={p['difficulty']} pv={p['pv_len']} "
                  f"decoys={p['decoys']} key={key}")
            print(render(list(p["board"])))
