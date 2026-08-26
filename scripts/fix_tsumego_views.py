#!/usr/bin/env python3
"""Пересчитать `view` каждой задачи: bbox(камни ∪ ВСЕ ходы дерева) + margin.

Импорт (import_tsumego_txt.py) считал view только от начальных камней;
KataGo-разметка позже дописала линии, выбегающие за окно, — 499 задач
получили ходы вне view (378 из них нерешаемы в UI: ход решателя не
отрисовывается и не тапается). Логика повторяет engine/tsumego.js
viewRect(): stones ∪ tree, margin 2, clamp к доске.

Идемпотентен. Прогонять после каждого merge разметки (merge теперь сам
вызывает recompute_view — этот скрипт остаётся для ручной починки).
"""

import json
from pathlib import Path

SGF = "abcdefghijklmnopqrs"
MARGIN = 2


def recompute_view(problem, margin=MARGIN):
    """Вернуть True, если view изменился. Задачи без сохранённого view
    (сиды 9×9) не трогаем — движок сам считает окно на лету."""
    if not problem.get("view"):
        return False
    size = problem.get("size") or 9
    pts = [i for i, ch in enumerate(problem["board"]) if ch != "."]

    def add_tree(nodes):
        for n in nodes or []:
            pts.append(SGF.index(n["at"][1]) * size + SGF.index(n["at"][0]))
            add_tree(n.get("children"))

    add_tree(problem.get("tree"))
    if not pts:
        return False
    cols = [i % size for i in pts]
    rows = [i // size for i in pts]
    view = {
        "c0": max(0, min(cols) - margin),
        "r0": max(0, min(rows) - margin),
        "c1": min(size - 1, max(cols) + margin),
        "r1": min(size - 1, max(rows) + margin),
    }
    if view == problem["view"]:
        return False
    problem["view"] = view
    return True


def main():
    root = Path(__file__).resolve().parent.parent
    for path in [root / "data/tsumego/problems.json",
                 root / "apps/mobile/src/data/tsumego.json"]:
        db = json.loads(path.read_text(encoding="utf-8"))
        changed = sum(1 for p in db["problems"] if recompute_view(p))
        path.write_text(json.dumps(db, ensure_ascii=False, indent=1),
                        encoding="utf-8")
        print(f"{path.relative_to(root)}: view пересчитан у {changed} задач")


if __name__ == "__main__":
    main()
