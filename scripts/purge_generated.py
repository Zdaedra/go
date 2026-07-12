#!/usr/bin/env python3
"""Remove procedurally generated (gen-*) problems from the app DB.

Product decision 2026-07-12: the generated set (432 problems) was ~9 templates
stretched by symmetry/translation — 53-64% D4-duplicates measured — so users
kept seeing "the same picture". The DB keeps the classical collections
(gokyo/xuanxuan/igo, 1025) and the 14 handmade seeds (cap-*/ld-*). New content
arrives via sourcing through merge_generated.py, which now carries a D4+color
canonical dedup gate.

Idempotent. Writes both DB copies (app bundle + repo). Prints a before/after
summary. Categories/sections that end up empty are dropped.
"""

import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_DB = ROOT / "apps/mobile/src/data/tsumego.json"
REPO_DB = ROOT / "data/tsumego/problems.json"


def main(prefix="gen-"):
    db = json.loads(APP_DB.read_text(encoding="utf-8"))
    before = db["problems"]
    kept = [p for p in before if not p["id"].startswith(prefix)]
    removed = len(before) - len(kept)
    db["problems"] = kept

    # drop sections/categories left with no problems
    used = {(p.get("category"), p.get("section")) for p in kept}
    used_cats = {c for c, _ in used}
    dropped_secs = []
    for cat in db["categories"]:
        keep_secs = [s for s in cat["sections"] if (cat["id"], s["id"]) in used]
        dropped_secs += [f"{cat['id']}/{s['id']}" for s in cat["sections"]
                         if s not in keep_secs]
        cat["sections"] = keep_secs
    db["categories"] = [c for c in db["categories"]
                        if c["id"] in used_cats and c["sections"]]

    APP_DB.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
    REPO_DB.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"removed {removed} {prefix}* problems; DB now {len(kept)}")
    if dropped_secs:
        print("dropped empty sections:", ", ".join(dropped_secs))
    print("by domain:", dict(Counter(p.get("domain", "?") for p in kept)))
    print("by source:", dict(Counter(p["id"].split("-")[0] for p in kept)))


if __name__ == "__main__":
    import sys
    main(sys.argv[1] if len(sys.argv) > 1 else "gen-")
