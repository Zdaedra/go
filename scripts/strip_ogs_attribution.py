#!/usr/bin/env python3
"""Снять авторские строки с OGS-задач (гигиена прав перед публикацией).

OGS-контент — user-generated, каждый автор держит права (personal-use-
unverified). В UI авторские строки не показываются, но лежат в данных. Убираем:
  - marked_by.owner          (имена людей: «Paul Smith» и др.)
  - marked_by.collection_label (авторские названия коллекций)
  - title                     (авторские заголовки задач)

Оставляем для НАШЕЙ трассировки перед лицензионной очисткой: числовой
marked_by.collection (id), source=online-go.com, license. Идемпотентно;
пишет обе копии БД (бандл приложения + репо).
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DBS = [ROOT / "apps/mobile/src/data/tsumego.json",
       ROOT / "data/tsumego/problems.json"]


def strip(db: dict) -> int:
    n = 0
    for p in db["problems"]:
        if not p["id"].startswith("ogs-"):
            continue
        changed = False
        mb = p.get("marked_by")
        if isinstance(mb, dict):
            for k in ("owner", "collection_label"):
                if k in mb:
                    del mb[k]; changed = True
        if p.get("title"):
            p["title"] = ""; changed = True   # заголовок нигде не рендерится
        if changed:
            n += 1
    return n


for path in DBS:
    db = json.loads(path.read_text(encoding="utf-8"))
    n = strip(db)
    path.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{path.relative_to(ROOT)}: очищено {n} OGS-задач")
