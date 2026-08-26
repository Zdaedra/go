#!/usr/bin/env python3
"""Merge solver-certified generated problems into the app tsumego database.

Reads data/tsumego/generated/*.json (from gen_tsumego.py), appends their
problems to the app DB, and ensures each generated category/section exists.
Idempotent: a problem id already present is skipped, so re-running after a
regenerate only adds what's new.

Writes both the bundled copy (apps/mobile/src/data/tsumego.json) and the repo
copy (data/tsumego/problems.json). Run scripts/audit_tsumego_tree.py after.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_DB = ROOT / "apps/mobile/src/data/tsumego.json"
REPO_DB = ROOT / "data/tsumego/problems.json"
GEN_DIR = ROOT / "data/tsumego/generated"


def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


_SWAP = str.maketrans("bw", "wb")


def _canon_board(b):
    """Lexicographic min of the board string over its D4 orbit (4 rotations
    x reflection). Size-aware: works for 9x9 (81) and 19x19 (361) boards."""
    n = int(round(len(b) ** 0.5))
    rows = [b[i * n:(i + 1) * n] for i in range(n)]
    best = None
    r = rows
    for _ in range(4):
        for cand in (r, [x[::-1] for x in r]):
            f = "".join(cand)
            if best is None or f < best:
                best = f
        r = ["".join(r[n - 1 - j][i] for j in range(n)) for i in range(n)]
    return best


def canon_key(prob):
    """Symmetry+color identity of a problem: min over the D4 orbit of
    (board, to_move) and its color-swapped mirror (colors AND to_move
    flipped together). Keeps ld-kill/ld-live pairs distinct — they share a
    board but differ in to_move. Guards against the 53-64% symmetry-dup
    rate measured in the shipped generated set (audit 2026-07-12)."""
    b = prob["board"]
    tm = prob.get("to_move", "b")
    return min((_canon_board(b), tm),
               (_canon_board(b.translate(_SWAP)), "w" if tm == "b" else "b"))


def main(only=None):
    db = load(APP_DB)
    existing_ids = {p["id"] for p in db["problems"]}
    # Positional identity of everything already shipped: new content that is a
    # rotation/reflection/color-swap of an existing problem is skipped.
    existing_keys = {canon_key(p) for p in db["problems"]}
    cat_by_id = {c["id"]: c for c in db["categories"]}

    added = 0
    gen_files = sorted(GEN_DIR.glob("*.json"))
    if only:
        gen_files = [f for f in gen_files if f.stem in only]
    for gf in gen_files:
        gen = load(gf)
        if "problems" not in gen:          # intermediate file (e.g. ld_candidates)
            print(f"  {gf.name}: no 'problems' key, skipped")
            continue
        # ensure categories/sections exist
        for gcat in gen.get("categories", []):
            cat = cat_by_id.get(gcat["id"])
            if cat is None:
                cat = {"id": gcat["id"], "title": gcat.get("title", gcat["id"]),
                       "sections": []}
                db["categories"].append(cat)
                cat_by_id[gcat["id"]] = cat
            have = {s["id"] for s in cat["sections"]}
            for sec in gcat.get("sections", []):
                if sec["id"] not in have:
                    cat["sections"].append(sec)
        # append problems (skip id dups and symmetry/color-orbit dups)
        n = sym_dup = 0
        for prob in gen["problems"]:
            if prob["id"] in existing_ids:
                continue
            key = canon_key(prob)
            if key in existing_keys:
                sym_dup += 1
                continue
            db["problems"].append(prob)
            existing_ids.add(prob["id"])
            existing_keys.add(key)
            n += 1
        added += n
        extra = f" (skipped {sym_dup} symmetry/color dups)" if sym_dup else ""
        print(f"  {gf.name}: +{n} problems{extra}")

    APP_DB.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
    REPO_DB.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
    from collections import Counter
    print(f"\nadded {added} problems; DB now {len(db['problems'])} total")
    tree = [p for p in db["problems"] if p.get("tree")]
    print("with tree:", len(tree))
    print("by domain:", dict(Counter(p.get("domain", "?") for p in tree)))


if __name__ == "__main__":
    only = sys.argv[1:] or None  # e.g. `merge_generated.py capture`
    main(only)
