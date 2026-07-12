#!/usr/bin/env python3
"""Re-tag Igo Hatsuyoron problems by theme, using the 1982-edition index.

The 174 imported igo-hatsuyoron problems were bulk-labeled `ld-live` (they came
in as page-range sections with no theme). Sensei's Library publishes the
complete problem-number -> category index following the 1982 Fujisawa edition
(Toyo Bunko 412):

  Live 1-30 · Kill 31-62 · Play-inside 63-76 · Ko 77-103 · Capturing-race
  104-120 · Connect-underneath 121-131 · Wedge 132-139 · Oiotoshi 140-155 ·
  Net 156-169 · Escaping 170-183

Verified alignment (2026-07-12): our ids preserve this numbering — present set
is {1..181} minus {73,76,116,120,131,154,180,182,183}, and the section sums
reproduce 174 exactly (#120, the famous hardest problem, is among the dropped).
The index is uncopyrightable factual metadata of a 1713 public-domain work.

Sets each problem's `theme` (precise SL category, authoritative) and `domain`
(6-way engine fold). domain_of() in annotate_tsumego_difficulty.py now respects
`theme`, so this survives re-annotation.

Folds: live->ld-live, kill/play-inside->ld-kill, ko->ko, capturing-race->race,
connect-under->connect, net/oiotoshi->capture. SOFT (flag for visual review):
wedge->connect, escape->race.

Idempotent. Writes both DB copies. Reversible (drops `theme`, restores ld-live).
"""

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_DB = ROOT / "apps/mobile/src/data/tsumego.json"
REPO_DB = ROOT / "data/tsumego/problems.json"


def sl_theme(n):
    if n <= 30: return "live"
    if n <= 62: return "kill"
    if n <= 76: return "play-inside"
    if n <= 103: return "ko"
    if n <= 120: return "capturing-race"
    if n <= 131: return "connect-under"
    if n <= 139: return "wedge"
    if n <= 155: return "oiotoshi"
    if n <= 169: return "net"
    return "escape"


# 6-way domain fold. SOFT entries flagged in THEME_SOFT for the review note.
THEME_DOMAIN = {
    "live": "ld-live", "kill": "ld-kill", "play-inside": "ld-kill",
    "ko": "ko", "capturing-race": "race", "connect-under": "connect",
    "net": "capture", "oiotoshi": "capture",
    "wedge": "connect", "escape": "race",
}
THEME_SOFT = {"wedge", "escape"}   # low-confidence folds — visual spot-check


def restore(revert=False):
    db = json.loads(APP_DB.read_text(encoding="utf-8"))
    igo = [p for p in db["problems"] if p["id"].startswith("igo-hatsuyoron-")]
    changed = 0
    for p in igo:
        n = int(re.search(r"(\d+)$", p["id"]).group(1))
        if revert:
            p.pop("theme", None)
            if p.get("domain") != "ld-live":
                p["domain"] = "ld-live"; changed += 1
            continue
        th = sl_theme(n)
        dom = THEME_DOMAIN[th]
        if p.get("theme") != th or p.get("domain") != dom:
            changed += 1
        p["theme"] = th
        p["domain"] = dom
    for path in (APP_DB, REPO_DB):
        path.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{'reverted' if revert else 're-tagged'} {len(igo)} igo problems "
          f"({changed} changed)")
    if not revert:
        by_dom = Counter(p["domain"] for p in igo)
        by_th = Counter(p.get("theme") for p in igo)
        print("theme :", dict(by_th))
        print("domain:", dict(by_dom))
        print("SOFT folds needing visual check:",
              {t: by_th[t] for t in THEME_SOFT})
        # spot-check anchors: one id per theme for eyeballing against SL
        print("\nspot-check (verify against senseis.xmp.net/?IgoHatsuyoRonProblems):")
        seen = set()
        for p in sorted(igo, key=lambda x: int(re.search(r'(\d+)$', x['id']).group(1))):
            th = p["theme"]
            if th not in seen:
                seen.add(th)
                print(f"  {p['id']} -> theme={th} domain={p['domain']} "
                      f"diff={p.get('difficulty')}")


if __name__ == "__main__":
    import sys
    restore(revert="--revert" in sys.argv)
