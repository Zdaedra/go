#!/usr/bin/env python3
"""Р1: пере-доменизация задач rule-based классификатором (позиция + дерево).

Домен у 517 задач (xuanxuan-qijing, igo-hatsuyoron) — дефолт ld-live, а не
разметка: их секции — номера страниц. Классификатор восстанавливает домен
из главной линии и структуры позиции. Порядок правил (сверху вниз):

  1. ko      — в главной линии есть ко-взятие (немедленный обратный захват
               запрещён правилом ко);
  2. race    — две смежные разноцветные группы с малыми свободами, главная
               линия заполняет свободы чужой группы;
  3. connect — первый ход решателя меняет связность (склеивает свои группы
               или режет чужие);
  4. capture — главная линия снимает камни при малой цели (вкл. oiotoshi);
  5. ld-live / ld-kill — целевая (самая запертая) группа в view: решатель
               играет за её цвет → live, против → kill.

Валидация: gokyo-секции + seed — эталон (их домены настоящие). Скрипт
меряет точность на них ДО применения к неразмеченным.

Usage:
  python3 scripts/redomain_tsumego.py            # валидация на gokyo+seed
  python3 scripts/redomain_tsumego.py --apply    # применить к xuanxuan+hatsuyoron
                                                 #   (старое -> domain_legacy)
  python3 scripts/redomain_tsumego.py --qa qa.md # выборка 60 задач на ручное QA
"""

import argparse
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

SGF = "abcdefghijklmnopqrs"

# Пороги правил (тюнились на gokyo-эталоне)
RACE_MAX_LIBS = 4        # обе группы гонки имеют <= свобод
RACE_MIN_FILLS = 2       # решатель заполнил >= стольких свобод цели
CAPTURE_MAX_TARGET = 6   # «малая цель» для capture
LD_MIN_GROUP = 3         # целевая группа для live/kill: приоритетный размер


def sgf_to_idx(coord, size):
    return SGF.index(coord[1]) * size + SGF.index(coord[0])


def neighbors(i, size):
    c, r = i % size, i // size
    if c > 0: yield i - 1
    if c < size - 1: yield i + 1
    if r > 0: yield i - size
    if r < size - 1: yield i + size


def groups_of(board, size):
    """[{color, stones:set, libs:set}] для всех групп на доске."""
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
    """Ход с захватами; возвращает (новая_доска, снятые_камни) или None."""
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
    """[(idx, color)] главной линии: первый не-wrong корень, далее children[0]."""
    size = problem.get("size") or 9
    tree = problem.get("tree") or []
    node = next((n for n in tree if n.get("tag") != "wrong"), None)
    out = []
    while node:
        out.append((sgf_to_idx(node["at"], size), node["by"]))
        node = (node.get("children") or [None])[0]
    return out


def all_lines(problem):
    """Все линии дерева (включая опровержения): списки [(idx, color)]."""
    size = problem.get("size") or 9
    out = []

    def rec(node, acc):
        acc = acc + [(sgf_to_idx(node["at"], size), node["by"])]
        children = node.get("children") or []
        if not children:
            out.append(acc)
        for ch in children:
            rec(ch, acc)

    for root in problem.get("tree") or []:
        rec(root, [])
    return out


def ko_in_line(board0, line, size):
    """Есть ли в линии ко-взятие (обратный захват запрещён правилом ко)."""
    b = board0
    for idx, color in line:
        res = play(b, idx, color, size)
        if res is None:
            return False
        nb, captured = res
        if len(captured) == 1:
            (q,) = captured
            back = play(nb, q, "w" if color == "b" else "b", size)
            if back is not None and back[0] == b:
                return True
        b = nb
    return False


def ko_shape_at_end(board0, line, size):
    """Ко-форма в финальной позиции линии: есть точка, где взятие одного
    камня немедленно не отыгрывается (простое ко)."""
    b = board0
    for idx, color in line:
        res = play(b, idx, color, size)
        if res is None:
            return False
        b = res[0]
    # проверяем оба цвета: взял бы один камень, а обратный захват запрещён
    for i, ch in enumerate(b):
        if ch != ".":
            continue
        for color in ("b", "w"):
            res = play(b, i, color, size)
            if res is None:
                continue
            nb, captured = res
            if len(captured) != 1:
                continue
            (q,) = captured
            back = play(nb, q, "w" if color == "b" else "b", size)
            if back is not None and back[0] == b:
                return True
    return False


def classify(problem):
    size = problem.get("size") or 9
    board0 = problem["board"]
    to_move = problem["to_move"]
    enemy = "w" if to_move == "b" else "b"
    line = main_line(problem)
    if not line:
        return None

    # --- реплей главной линии: снятия, финальная доска ---
    total_captured = {"b": 0, "w": 0}
    b = board0
    final_board = board0
    for idx, color in line:
        res = play(b, idx, color, size)
        if res is None:
            break
        nb, captured = res
        for c in captured:
            total_captured[b[c]] += 1
        b = nb
    final_board = b

    # --- 1. ko: взятие ко в ЛЮБОЙ ветке дерева, либо ко-форма в финале
    #     главной линии (результат задачи — ко) ---
    if any(ko_in_line(board0, ln, size) for ln in all_lines(problem)):
        return "ko"
    if ko_shape_at_end(board0, line, size):
        return "ko"

    groups0 = groups_of(board0, size)
    groups_end = groups_of(final_board, size)

    # --- 2. capture: чужие камни сняты по ходу линии (малая цель), либо
    #     чужая группа в финале стоит в атари после хода решателя ---
    if 0 < total_captured[enemy] <= CAPTURE_MAX_TARGET:
        return "capture"
    end_atari = [
        g for g in groups_end
        if g["color"] == enemy and len(g["libs"]) == 1
        and len(g["stones"]) <= CAPTURE_MAX_TARGET
    ]
    if end_atari and line and line[-1][1] == to_move and not total_captured[to_move]:
        return "capture"

    # --- 3. race: пара смежных разноцветных групп, обе с малыми свободами,
    #     решатель заполнил >= RACE_MIN_FILLS свобод чужой ---
    solver_moves = [idx for idx, color in line if color == to_move]
    for g in groups0:
        if g["color"] != enemy or len(g["libs"]) > RACE_MAX_LIBS:
            continue
        if len(g["stones"]) < 2:
            continue
        adj_own = [
            h for h in groups0
            if h["color"] == to_move and len(h["libs"]) <= RACE_MAX_LIBS
            and len(h["stones"]) >= 2
            and any(n in g["stones"] for s in h["stones"] for n in neighbors(s, size))
        ]
        if not adj_own:
            continue
        fills = sum(1 for m in solver_moves if m in g["libs"])
        if fills >= RACE_MIN_FILLS:
            return "race"

    # --- 4. connect: к КОНЦУ линии свои группы склеились (или чужие
    #     оказались разрезаны) по сравнению со стартом ---
    def multi_groups(groups, color):
        return sum(1 for g in groups if g["color"] == color and len(g["stones"]) >= 2)

    own0, own1 = multi_groups(groups0, to_move), multi_groups(groups_end, to_move)
    enemy0, enemy1 = multi_groups(groups0, enemy), multi_groups(groups_end, enemy)
    if own1 < own0 and not total_captured[to_move]:
        return "connect"
    if enemy1 > enemy0 and not total_captured[enemy]:
        return "connect"

    # --- 5. ld-live / ld-kill: самая запертая группа в view ---
    view = problem.get("view")

    def in_view(i):
        if not view:
            return True
        c, r = i % size, i // size
        return view["c0"] <= c <= view["c1"] and view["r0"] <= r <= view["r1"]

    cands = [
        g for g in groups0
        if len(g["stones"]) >= LD_MIN_GROUP and all(in_view(s) for s in g["stones"])
    ] or [
        g for g in groups0
        if len(g["stones"]) >= 2 and all(in_view(s) for s in g["stones"])
    ]
    if not cands:
        return "ld-live"
    # запертость: мало свобод на камень; крупная группа предпочтительнее
    target = min(
        cands,
        key=lambda g: (len(g["libs"]) / len(g["stones"]), -len(g["stones"])),
    )
    return "ld-live" if target["color"] == to_move else "ld-kill"


def validate(db):
    """Точность на эталоне: gokyo-секции + seed."""
    gold = [p for p in db["problems"]
            if p["category"] in ("gokyo-shumyo", "capture", "life-death")
            and p.get("tree")]
    conf = defaultdict(Counter)
    hits = total = 0
    for p in gold:
        pred = classify(p)
        true = p["domain"]
        if p["category"] == "gokyo-shumyo" and p["section"] == "various":
            continue  # 'various' — сам дефолт, не эталон
        conf[true][pred] += 1
        total += 1
        hits += (pred == true)
    print(f"эталон (gokyo без various + seed): {total} задач, "
          f"точность {hits}/{total} = {hits/total:.1%}")
    print(f"{'true \\ pred':12s}", *(f"{d:>8s}" for d in
          ["capture", "ld-live", "ld-kill", "ko", "race", "connect"]))
    for true in ["capture", "ld-live", "ld-kill", "ko", "race", "connect"]:
        row = conf[true]
        print(f"{true:12s}", *(f"{row.get(d, 0):8d}" for d in
              ["capture", "ld-live", "ld-kill", "ko", "race", "connect"]))
    return hits / total if total else 0.0


def apply_domains(paths):
    for path in paths:
        db = json.loads(path.read_text(encoding="utf-8"))
        changed = 0
        for p in db["problems"]:
            if p["category"] not in ("xuanxuan-qijing", "igo-hatsuyoron"):
                continue
            if not p.get("tree"):
                continue
            pred = classify(p)
            if pred and pred != p["domain"]:
                p["domain_legacy"] = p["domain"]
                p["domain"] = pred
                changed += 1
            elif pred:
                p["domain_legacy"] = p.get("domain_legacy", p["domain"])
        path.write_text(json.dumps(db, ensure_ascii=False, indent=1),
                        encoding="utf-8")
        print(f"{path}: домен обновлён у {changed} задач")


def qa_sample(db, out_path):
    """60 задач на ручное QA: по 10 на предсказанный домен (xuanxuan+hatsuyoron)."""
    random.seed(20260711)
    by_dom = defaultdict(list)
    for p in db["problems"]:
        if p["category"] in ("xuanxuan-qijing", "igo-hatsuyoron") and p.get("tree"):
            by_dom[classify(p)].append(p)
    lines = ["# QA-выборка Р1: проверь домен (10 на класс)\n",
             "| # | id | предсказано | твой вердикт (ok / нужный домен) |",
             "|---|----|-------------|-----------------------------------|"]
    n = 0
    for dom in ["capture", "ld-live", "ld-kill", "ko", "race", "connect"]:
        pool = by_dom.get(dom, [])
        for p in random.sample(pool, min(10, len(pool))):
            n += 1
            lines.append(f"| {n} | {p['id']} | {dom} | |")
    Path(out_path).write_text("\n".join(lines), encoding="utf-8")
    print(f"QA-выборка: {n} задач → {out_path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--qa")
    args = ap.parse_args()

    root = Path(__file__).resolve().parent.parent
    data = root / "data/tsumego/problems.json"
    app = root / "apps/mobile/src/data/tsumego.json"
    db = json.loads(data.read_text(encoding="utf-8"))

    acc = validate(db)
    if args.qa:
        qa_sample(db, args.qa)
    if args.apply:
        if acc < 0.80:
            print(f"ОТКАЗ: точность {acc:.1%} < 80% — правила надо крутить")
            return 1
        apply_domains([data, app])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
