#!/usr/bin/env python3
"""Import a folder of tsumego SGF files into the app's problems format.

Use this to merge large public-domain collections (e.g. the classical
Gokyo Shumyo / Xuanxuan Qijing / Igo Hatsuyoron sets) once their SGFs are
available locally:

    python3 scripts/import_tsumego_sgf.py <sgf_dir> <category_id> <section_id> \
        --category-title "Жизнь и смерть" --section-title "Классика: Гокё Сюмё" \
        [--out apps/mobile/src/data/tsumego.json]

Rules applied while importing:
  - AB/AW give the starting position; PL or the first move color sets to_move.
  - The variation tree becomes the solution tree. A node whose comment
    contains "correct/right/good/正解" (case-insensitive) is tagged correct;
    "wrong/incorrect/failure/失敗" tags wrong. If the file has no such
    annotations, every leaf of the main line is treated as correct.
  - Problems on boards larger than 9x9 are translated into the nearest
    corner if all stones fit into a 9x9 area, otherwise skipped (the app
    currently renders a 9x9 goban); a summary reports skips.
"""

import argparse
import json
import re
import sys
from pathlib import Path

SIZE = 9

TOKEN = re.compile(r"([A-Za-z]+)((?:\[[^\]]*\])+)|(\(|\)|;)")
PROPVAL = re.compile(r"\[([^\]]*)\]")

CORRECT = re.compile(r"correct|right|good|正解|정답", re.I)
WRONG = re.compile(r"wrong|incorrect|fail|失敗|오답", re.I)


def parse_sgf(text):
    """Parse SGF into a nested node structure: {props, children}."""
    tokens = []
    for m in TOKEN.finditer(text):
        if m.group(3):
            tokens.append(m.group(3))
        else:
            tokens.append((m.group(1), PROPVAL.findall(m.group(2))))
    pos = 0

    def parse_seq():
        nonlocal pos
        nodes = []
        while pos < len(tokens):
            t = tokens[pos]
            if t == ";":
                pos += 1
                props = {}
                while pos < len(tokens) and isinstance(tokens[pos], tuple):
                    key, vals = tokens[pos]
                    props.setdefault(key.upper(), []).extend(vals)
                    pos += 1
                nodes.append({"props": props, "children": []})
            elif t == "(":
                pos += 1
                sub = parse_seq()
                if nodes:
                    nodes[-1]["children"].append(sub)
                pos += 1  # ')'
            elif t == ")":
                break
            else:
                pos += 1
        # chain sequential nodes
        for a, b in zip(nodes, nodes[1:]):
            a["children"].insert(0, b)
        return nodes[0] if nodes else {"props": {}, "children": []}

    assert tokens and tokens[0] == "(", "not an SGF"
    pos = 1
    return parse_seq()


def coords_of(vals, board_size):
    out = []
    for v in vals:
        if len(v) == 2:
            out.append((ord(v[0]) - 97, ord(v[1]) - 97))
        elif len(v) == 5 and v[2] == ":":  # compressed point list ab:cd
            c1, r1 = ord(v[0]) - 97, ord(v[1]) - 97
            c2, r2 = ord(v[3]) - 97, ord(v[4]) - 97
            for c in range(min(c1, c2), max(c1, c2) + 1):
                for r in range(min(r1, r2), max(r1, r2) + 1):
                    out.append((c, r))
    return [(c, r) for c, r in out if 0 <= c < board_size and 0 <= r < board_size]


def translate(points, board_size):
    """Shift a corner problem into the 9x9 top-left corner, or None."""
    if not points:
        return None
    cols = [c for c, _ in points]
    rows = [r for _, r in points]
    w, h = max(cols) - min(cols), max(rows) - min(rows)
    if w >= SIZE - 1 or h >= SIZE - 1:
        return None
    # Mirror so the action is in the top-left, then shift to origin margin.
    flip_c = (min(cols) + max(cols)) / 2 > (board_size - 1) / 2
    flip_r = (min(rows) + max(rows)) / 2 > (board_size - 1) / 2

    def f(c, r):
        c2 = board_size - 1 - c if flip_c else c
        r2 = board_size - 1 - r if flip_r else r
        return c2, r2

    pts = [f(c, r) for c, r in points]
    dc, dr = min(c for c, _ in pts), min(r for _, r in pts)
    return lambda c, r: (
        (board_size - 1 - c if flip_c else c) - dc,
        (board_size - 1 - r if flip_r else r) - dr,
    )


def convert_tree(node, tf, has_tags):
    out_children = []
    for child in node["children"]:
        p = child["props"]
        move = None
        for key, by in (("B", "b"), ("W", "w")):
            if key in p and p[key] and p[key][0]:
                c, r = ord(p[key][0][0]) - 97, ord(p[key][0][1]) - 97
                tc, tr = tf(c, r)
                if not (0 <= tc < SIZE and 0 <= tr < SIZE):
                    move = "off"
                    break
                move = (chr(97 + tc) + chr(97 + tr), by)
        if move in (None, "off"):
            continue
        comment = " ".join(p.get("C", []))
        tag = None
        if CORRECT.search(comment):
            tag = "correct"
        elif WRONG.search(comment):
            tag = "wrong"
        sub = convert_tree(child, tf, has_tags)
        entry = {"at": move[0], "by": move[1]}
        if tag:
            entry["tag"] = tag
        elif not has_tags and not sub:
            entry["tag"] = "correct"  # untagged leaf on kept lines
        if sub:
            entry["children"] = sub
        out_children.append(entry)
    return out_children


def has_any_tags(node):
    comment = " ".join(node["props"].get("C", []))
    if CORRECT.search(comment) or WRONG.search(comment):
        return True
    return any(has_any_tags(c) for c in node["children"])


def import_file(path, category, section, idx):
    root = parse_sgf(path.read_text(encoding="utf-8", errors="replace"))
    props = root["props"]
    board_size = int((props.get("SZ") or ["19"])[0])
    ab = coords_of(props.get("AB", []), board_size)
    aw = coords_of(props.get("AW", []), board_size)
    tf = translate(ab + aw, board_size)
    if tf is None:
        return None
    cells = ["."] * (SIZE * SIZE)
    for c, r in ab:
        tc, tr = tf(c, r)
        cells[tr * SIZE + tc] = "b"
    for c, r in aw:
        tc, tr = tf(c, r)
        cells[tr * SIZE + tc] = "w"
    to_move = "b"
    pl = props.get("PL")
    if pl:
        to_move = "b" if pl[0].upper() == "B" else "w"
    tree = convert_tree(root, tf, has_any_tags(root))
    if not tree:
        return None
    title = (props.get("GN") or props.get("N") or [f"Задача {idx}"])[0][:60]
    return {
        "id": f"{section}-{idx:04d}",
        "category": category,
        "section": section,
        "title": title,
        "to_move": to_move,
        "board": "".join(cells),
        "tree": tree,
        "hint": None,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sgf_dir")
    ap.add_argument("category_id")
    ap.add_argument("section_id")
    ap.add_argument("--category-title", default=None)
    ap.add_argument("--section-title", default=None)
    ap.add_argument("--out", default="apps/mobile/src/data/tsumego.json")
    args = ap.parse_args()

    out_path = Path(args.out)
    db = json.loads(out_path.read_text(encoding="utf-8"))

    files = sorted(Path(args.sgf_dir).rglob("*.sgf"))
    added, skipped = 0, 0
    existing = {p["id"] for p in db["problems"]}
    for i, f in enumerate(files, 1):
        try:
            p = import_file(f, args.category_id, args.section_id, i)
        except Exception as e:  # noqa: BLE001 - report and move on
            print(f"skip {f.name}: {e}")
            p = None
        if p is None:
            skipped += 1
            continue
        if p["id"] in existing:
            continue
        db["problems"].append(p)
        added += 1

    cat = next((c for c in db["categories"] if c["id"] == args.category_id), None)
    if cat is None:
        cat = {"id": args.category_id,
               "title": args.category_title or args.category_id, "sections": []}
        db["categories"].append(cat)
    if not any(s["id"] == args.section_id for s in cat["sections"]):
        cat["sections"].append(
            {"id": args.section_id, "title": args.section_title or args.section_id})

    out_path.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"added {added}, skipped {skipped} (too big for 9x9 or empty), total {len(db['problems'])}")


if __name__ == "__main__":
    main()
