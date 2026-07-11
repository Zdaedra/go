#!/usr/bin/env python3
"""Р3: структурные объекты для ступени H1 (что подсвечивать, «на что смотреть»).

Для каждой задачи с ДОВЕРЕННЫМ доменом (gokyo-секции и seed сразу; xuanxuan/
hatsuyoron — после Р1-передоменизации, скрипт идемпотентен) вычисляет:

  structuralTargets — группы-объекты анализа по домену:
    ld-live  — своя слабейшая группа;      ld-kill — целевая чужая;
    race     — обе гонящиеся группы;       connect — соединяемые свои группы;
    capture  — объект взятия;              ko      — камни ко-взятия.
  h1Zone — прямоугольник подсветки: bbox(targets)+1, минимум 8–12
    пересечений, внутри view, центр не на верном первом ходе (v3.2 §5).

Не вычислилось уверенно → полей нет, H1 деградирует в доменный шаблон
(hintTemplates.json: h1Fallback). Пишет в оба JSON. Статистика покрытия — в
stdout.
"""

import json
from pathlib import Path

SGF = "abcdefghijklmnopqrs"
MIN_ZONE_AREA = 9        # 8–12 по ТЗ; берём 3×3 как жёсткий минимум
RACE_LIBS = 6            # мягче классификатора: цель уже известна из домена
TRUSTED_CATS = ("gokyo-shumyo", "capture", "life-death")


def sgf_to_idx(coord, size):
    return SGF.index(coord[1]) * size + SGF.index(coord[0])


def neighbors(i, size):
    c, r = i % size, i // size
    if c > 0: yield i - 1
    if c < size - 1: yield i + 1
    if r > 0: yield i - size
    if r < size - 1: yield i + size


def groups_of(board, size):
    seen, out = set(), []
    for i, ch in enumerate(board):
        if ch == "." or i in seen:
            continue
        stones, libs, stack = {i}, set(), [i]
        while stack:
            cur = stack.pop()
            for n in neighbors(cur, size):
                if board[n] == ".":
                    libs.add(n)
                elif board[n] == ch and n not in stones:
                    stones.add(n)
                    stack.append(n)
        seen |= stones
        out.append({"color": ch, "stones": stones, "libs": libs})
    return out


def play(board, idx, color, size):
    if board[idx] != ".":
        return None
    b = list(board)
    b[idx] = color
    enemy = "w" if color == "b" else "b"
    captured = set()
    for n in neighbors(idx, size):
        if b[n] == enemy:
            grp, libs = _grp(b, n, size)
            if not libs:
                captured |= grp
    for g in captured:
        b[g] = "."
    _, own = _grp(b, idx, size)
    if not own and not captured:
        return None
    return "".join(b), captured


def _grp(b, i, size):
    color = b[i]
    stones, libs, stack = {i}, set(), [i]
    while stack:
        cur = stack.pop()
        for n in neighbors(cur, size):
            if b[n] == ".":
                libs.add(n)
            elif b[n] == color and n not in stones:
                stones.add(n)
                stack.append(n)
    return stones, libs


def main_line(problem):
    size = problem.get("size") or 9
    node = next((n for n in (problem.get("tree") or [])
                 if n.get("tag") != "wrong"), None)
    out = []
    while node:
        out.append((sgf_to_idx(node["at"], size), node["by"]))
        node = (node.get("children") or [None])[0]
    return out


def in_view(i, view, size):
    if not view:
        return True
    c, r = i % size, i // size
    return view["c0"] <= c <= view["c1"] and view["r0"] <= r <= view["r1"]


def pick_targets(problem):
    """Список групп-целей (каждая — set камней) по домену. None = не вышло."""
    size = problem.get("size") or 9
    board = problem["board"]
    to_move = problem["to_move"]
    enemy = "w" if to_move == "b" else "b"
    view = problem.get("view")
    domain = problem["domain"]
    groups = groups_of(board, size)
    line = main_line(problem)

    def viewed(gs, min_stones=2):
        return [g for g in gs if len(g["stones"]) >= min_stones
                and all(in_view(s, view, size) for s in g["stones"])]

    def weakest(gs):
        return min(gs, key=lambda g: (len(g["libs"]) / len(g["stones"]),
                                      -len(g["stones"]))) if gs else None

    if domain == "ld-live":
        own = viewed([g for g in groups if g["color"] == to_move])
        t = weakest(own)
        return [t["stones"]] if t else None

    if domain == "ld-kill":
        opp = viewed([g for g in groups if g["color"] == enemy])
        t = weakest(opp)
        return [t["stones"]] if t else None

    if domain == "race":
        best_pair, best_score = None, 1e9
        for g in groups:
            if g["color"] != enemy or len(g["libs"]) > RACE_LIBS:
                continue
            for h in groups:
                if h["color"] != to_move or len(h["libs"]) > RACE_LIBS:
                    continue
                touch = any(n in g["stones"]
                            for s in h["stones"] for n in neighbors(s, size))
                if not touch:
                    continue
                score = len(g["libs"]) + len(h["libs"])
                if score < best_score:
                    best_pair, best_score = (g, h), score
        return [best_pair[0]["stones"], best_pair[1]["stones"]] if best_pair else None

    if domain == "connect":
        first = next((idx for idx, color in line if color == to_move), None)
        if first is None:
            return None
        near = [g for g in groups if g["color"] == to_move
                and any(n in g["stones"] for n in neighbors(first, size))]
        if len(near) >= 2:
            return [g["stones"] for g in near]
        # запасной вариант: две свои группы, ближайшие к первому ходу
        own = [g for g in groups if g["color"] == to_move]
        if len(own) < 2:
            return None
        fc, fr = first % size, first // size
        own.sort(key=lambda g: min(abs(s % size - fc) + abs(s // size - fr)
                                   for s in g["stones"]))
        return [own[0]["stones"], own[1]["stones"]]

    if domain in ("capture", "ko"):
        # объект взятия: чужие камни, снятые в главной линии
        b = board
        captured_all = set()
        for idx, color in line:
            res = play(b, idx, color, size)
            if res is None:
                break
            nb, captured = res
            captured_all |= {c for c in captured if board[c] == enemy or b[c] == enemy}
            b = nb
        if captured_all:
            hit = [g["stones"] for g in groups
                   if g["color"] == enemy and g["stones"] & captured_all]
            if hit:
                return hit
        # запасной: чужая группа в атари / слабейшая рядом с первым ходом
        opp = viewed([g for g in groups if g["color"] == enemy], min_stones=1)
        atari = [g for g in opp if len(g["libs"]) == 1]
        if atari:
            return [atari[0]["stones"]]
        t = weakest(opp)
        return [t["stones"]] if t else None

    return None


def zone_of(problem, targets):
    """h1Zone: bbox(targets)+1, ≥ MIN_ZONE_AREA, внутри view, центр не на
    верном первом ходе."""
    size = problem.get("size") or 9
    view = problem.get("view") or {"c0": 0, "r0": 0, "c1": size - 1, "r1": size - 1}
    pts = [s for t in targets for s in t]
    cs = [i % size for i in pts]
    rs = [i // size for i in pts]
    c0, c1 = max(view["c0"], min(cs) - 1), min(view["c1"], max(cs) + 1)
    r0, r1 = max(view["r0"], min(rs) - 1), min(view["r1"], max(rs) + 1)

    def area():
        return (c1 - c0 + 1) * (r1 - r0 + 1)

    # расширяем до минимальной площади, оставаясь в view
    while area() < MIN_ZONE_AREA:
        grown = False
        if c0 > view["c0"]: c0 -= 1; grown = True
        if area() >= MIN_ZONE_AREA: break
        if c1 < view["c1"]: c1 += 1; grown = True
        if area() >= MIN_ZONE_AREA: break
        if r0 > view["r0"]: r0 -= 1; grown = True
        if area() >= MIN_ZONE_AREA: break
        if r1 < view["r1"]: r1 += 1; grown = True
        if not grown:
            break

    # центр зоны не должен совпадать с верным первым ходом
    line = main_line(problem)
    first = next((idx for idx, color in line
                  if color == problem["to_move"]), None)
    if first is not None:
        cc, cr = (c0 + c1) // 2, (r0 + r1) // 2
        if cr * size + cc == first:
            if c1 < view["c1"]: c1 += 1
            elif c0 > view["c0"]: c0 -= 1
            elif r1 < view["r1"]: r1 += 1
            elif r0 > view["r0"]: r0 -= 1
    return {"c0": c0, "r0": r0, "c1": c1, "r1": r1}


def trusted(problem):
    return problem["category"] in TRUSTED_CATS or "domain_legacy" in problem


def main():
    root = Path(__file__).resolve().parent.parent
    stats = {}
    for path in [root / "data/tsumego/problems.json",
                 root / "apps/mobile/src/data/tsumego.json"]:
        db = json.loads(path.read_text(encoding="utf-8"))
        done = skipped = degraded = 0
        for p in db["problems"]:
            if not p.get("tree") or not trusted(p):
                skipped += 1
                continue
            targets = pick_targets(p)
            if not targets:
                degraded += 1
                p.pop("structuralTargets", None)
                p.pop("h1Zone", None)
                continue
            p["structuralTargets"] = [sorted(t) for t in targets]
            p["h1Zone"] = zone_of(p, targets)
            done += 1
            stats.setdefault(p["domain"], [0, 0])[0] += 1
        for p in db["problems"]:
            if p.get("tree") and trusted(p) and "structuralTargets" not in p:
                stats.setdefault(p["domain"], [0, 0])[1] += 1
        path.write_text(json.dumps(db, ensure_ascii=False, indent=1),
                        encoding="utf-8")
        print(f"{path.relative_to(root)}: targets={done} degraded={degraded} "
              f"skipped(недоверенный домен/нет дерева)={skipped}")
    print("покрытие по доменам (ok/degraded):")
    for d, (ok, bad) in sorted(stats.items()):
        total = ok + bad
        print(f"  {d:10s} {ok}/{total} = {ok/total:.0%}" if total else f"  {d}: 0")


if __name__ == "__main__":
    main()
