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


def main(only=None):
    db = load(APP_DB)
    existing_ids = {p["id"] for p in db["problems"]}
    cat_by_id = {c["id"]: c for c in db["categories"]}

    added = 0
    gen_files = sorted(GEN_DIR.glob("*.json"))
    if only:
        gen_files = [f for f in gen_files if f.stem in only]
    for gf in gen_files:
        gen = load(gf)
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
        # append problems (skip duplicates)
        n = 0
        for prob in gen["problems"]:
            if prob["id"] in existing_ids:
                continue
            db["problems"].append(prob)
            existing_ids.add(prob["id"])
            n += 1
        added += n
        print(f"  {gf.name}: +{n} problems")

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
