#!/usr/bin/env python3
"""Generate the seed tsumego set for the mobile app.

All problems are classic, centuries-old teaching shapes (atari, ladder,
double atari, straight/bent three, T-four ...) constructed from scratch
here — no authored collection is copied. Full classical collections
(Gokyo Shumyo etc.) can be merged later via scripts/import_tsumego_sgf.py.

Output:
  apps/mobile/src/data/tsumego.json   (bundled into the app)
  data/tsumego/problems.json          (repo copy)

Every problem is verified: all tree moves are legal, capture problems
actually capture on the correct line, and wrong lines are marked.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_epub_openings import BOARD_SIZE, coord_to_idx, play  # noqa: E402


def board_from(black, white):
    cells = ["."] * (BOARD_SIZE * BOARD_SIZE)
    for c in black:
        cells[coord_to_idx(c)] = "b"
    for c in white:
        cells[coord_to_idx(c)] = "w"
    return "".join(cells)


def node(at, by, tag=None, children=None):
    out = {"at": at, "by": by}
    if tag:
        out["tag"] = tag
    if children:
        out["children"] = children
    return out


PROBLEMS = []


def problem(pid, category, section, title, black, white, tree, hint=None, to_move="b"):
    PROBLEMS.append({
        "id": pid,
        "category": category,
        "section": section,
        "title": title,
        "to_move": to_move,
        "board": board_from(black, white),
        "tree": tree,
        "hint": hint,
    })


# --- Захват камней / Атари и захват ----------------------------------------

problem(
    "cap-atari-1", "capture", "atari",
    "Захвати камень",
    black=["de", "ed", "fe"], white=["ee"],
    tree=[node("ef", "b", "correct")],
    hint="У белого камня осталась одна свобода.",
)

problem(
    "cap-atari-edge", "capture", "atari",
    "Захват на краю",
    black=["da", "fa"], white=["ea"],
    tree=[node("eb", "b", "correct")],
    hint="Камень на краю имеет мало свобод.",
)

problem(
    "cap-atari-corner", "capture", "atari",
    "Захват в углу",
    black=["ba"], white=["aa"],
    tree=[node("ab", "b", "correct")],
    hint="В углу достаточно одного хода.",
)

problem(
    "cap-two-stones", "capture", "atari",
    "Поймай два камня",
    black=["ed", "de", "fe", "df", "ff"], white=["ee", "ef"],
    tree=[node("eg", "b", "correct")],
    hint="У пары белых камней одна общая свобода.",
)

# --- Захват камней / Приёмы -------------------------------------------------

problem(
    "cap-double-atari", "capture", "technique",
    "Двойное атари",
    black=["dc", "cd", "cf", "dg"], white=["dd", "df"],
    tree=[
        node("de", "b", None, [
            node("ed", "w", None, [node("ef", "b", "correct")]),
            node("ef", "w", None, [node("ed", "b", "correct")]),
        ]),
        node("ed", "b", "wrong", [node("de", "w")]),
        node("ef", "b", "wrong", [node("de", "w")]),
    ],
    hint="Найди пункт, который ставит в атари сразу две группы.",
)

problem(
    "cap-ladder", "capture", "technique",
    "Лестница к краю",
    black=["hb", "gc"], white=["hc"],
    tree=[
        node("hd", "b", None, [
            node("ic", "w", None, [
                node("id", "b", None, [
                    node("ib", "w", None, [node("ia", "b", "correct")]),
                ]),
            ]),
        ]),
        node("ic", "b", "wrong", [node("hd", "w")]),
    ],
    hint="Гони камень в сторону края доски.",
)

problem(
    "cap-squeeze", "capture", "technique",
    "Последняя свобода",
    black=["fd", "ee", "ge", "gf", "fg"], white=["fe", "ff"],
    tree=[node("ef", "b", "correct")],
    hint="Сожми группу до нуля свобод.",
)

# --- Жизнь и смерть / Угол --------------------------------------------------

problem(
    "ld-corner-bent3-live", "life-death", "corner",
    "Согнутая тройка: живи",
    black=["bb", "ca", "ac", "cb", "bc"], white=[],
    tree=[
        node("aa", "b", "correct"),
        node("ba", "b", "wrong", [node("aa", "w")]),
        node("ab", "b", "wrong", [node("aa", "w")]),
    ],
    hint="Жизненно важный пункт — на сгибе.",
)

problem(
    "ld-corner-bent3-kill", "life-death", "corner",
    "Согнутая тройка: убей",
    black=["cc", "da", "db", "ad", "bd", "cd"],
    white=["bb", "ca", "ac", "cb", "bc"],
    tree=[
        node("aa", "b", "correct"),
        node("ba", "b", "wrong", [node("aa", "w")]),
        node("ab", "b", "wrong", [node("aa", "w")]),
    ],
    hint="Тот же пункт решает и в атаке.",
)

problem(
    "ld-corner-straight3-live", "life-death", "corner",
    "Прямая тройка: живи",
    black=["ab", "bb", "cb", "da", "db"], white=[],
    tree=[
        node("ba", "b", "correct"),
        node("aa", "b", "wrong", [node("ba", "w")]),
        node("ca", "b", "wrong", [node("ba", "w")]),
    ],
    hint="Раздели пространство на два глаза одним ходом.",
)

problem(
    "ld-corner-straight3-kill", "life-death", "corner",
    "Прямая тройка: убей",
    black=["ac", "bc", "cc", "dc", "ea", "eb", "ec"],
    white=["ab", "bb", "cb", "da", "db"],
    tree=[
        node("ba", "b", "correct"),
        node("aa", "b", "wrong", [node("ba", "w")]),
        node("ca", "b", "wrong", [node("ba", "w")]),
    ],
    hint="Центральный пункт пространства из трёх.",
)

problem(
    "ld-corner-t4-kill", "life-death", "corner",
    "Т-четвёрка: убей",
    black=["ea", "eb", "ac", "bc", "cc", "dc", "db"],
    white=["ab", "cb", "da", "bb"],
    tree=[
        node("ba", "b", "correct"),
        node("aa", "b", "wrong", [node("ba", "w")]),
        node("ca", "b", "wrong", [node("ba", "w")]),
    ],
    hint="У Т-образной четвёрки один жизненно важный пункт.",
)

# --- Жизнь и смерть / Сторона -----------------------------------------------

problem(
    "ld-side-straight3-live", "life-death", "side",
    "Тройка на стороне: живи",
    black=["ca", "ga", "db", "eb", "fb"], white=[],
    tree=[
        node("ea", "b", "correct"),
        node("da", "b", "wrong", [node("ea", "w")]),
        node("fa", "b", "wrong", [node("ea", "w")]),
    ],
    hint="Живи в центре пространства.",
)

problem(
    "ld-side-straight3-kill", "life-death", "side",
    "Тройка на стороне: убей",
    black=["ba", "bb", "cb", "dc", "ec", "fc", "gb", "ha", "hb"],
    white=["ca", "ga", "db", "eb", "fb"],
    tree=[
        node("ea", "b", "correct"),
        node("da", "b", "wrong", [node("ea", "w")]),
        node("fa", "b", "wrong", [node("ea", "w")]),
    ],
    hint="Убей тем же пунктом, которым группа жила бы.",
)

CATEGORIES = [
    {
        "id": "capture",
        "title": "Захват камней",
        "sections": [
            {"id": "atari", "title": "Атари и захват"},
            {"id": "technique", "title": "Приёмы захвата"},
        ],
    },
    {
        "id": "life-death",
        "title": "Жизнь и смерть",
        "sections": [
            {"id": "corner", "title": "Угол"},
            {"id": "side", "title": "Сторона"},
        ],
    },
]


# --- verification ------------------------------------------------------------

def walk(problem_, nodes, board, path):
    ok = True
    for n in nodes:
        res = play(list(board), coord_to_idx(n["at"]), n["by"])
        if res is None:
            print(f"ILLEGAL move {n['at']} in {problem_['id']} at {'>'.join(path)}")
            ok = False
            continue
        new_board = "".join(res)
        captured = board.count("w" if n["by"] == "b" else "b") - \
            new_board.count("w" if n["by"] == "b" else "b")
        if n.get("tag") == "correct" and not n.get("children"):
            if problem_["category"] == "capture" and captured <= 0:
                print(f"NO CAPTURE on correct leaf {n['at']} in {problem_['id']}")
                ok = False
        if n.get("children"):
            ok = walk(problem_, n["children"], new_board, path + [n["at"]]) and ok
    return ok


def main():
    all_ok = True
    for p in PROBLEMS:
        all_ok = walk(p, p["tree"], p["board"], []) and all_ok
    if not all_ok:
        raise SystemExit("verification failed")

    out = {
        "board_size": BOARD_SIZE,
        "source": "seed: classic public-domain teaching shapes, constructed for this app",
        "categories": CATEGORIES,
        "problems": PROBLEMS,
    }
    for target in [
        Path("apps/mobile/src/data/tsumego.json"),
        Path("data/tsumego/problems.json"),
    ]:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    n_by = {}
    for p in PROBLEMS:
        key = f"{p['category']}/{p['section']}"
        n_by[key] = n_by.get(key, 0) + 1
    for k, v in n_by.items():
        print(f"{k}: {v}")
    print(f"total: {len(PROBLEMS)} problems, verified OK")


if __name__ == "__main__":
    main()
