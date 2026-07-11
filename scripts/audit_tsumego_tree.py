#!/usr/bin/env python3
"""Р0: инварианты деревьев решений цумэго (гейт перед адаптивным движком).

Проверяет data/tsumego/problems.json + apps/mobile/src/data/tsumego.json:
  1. каждый нетегированный лист лежит под wrong-узлом (иначе движок выдаст
     'solved' за неразмеченную ветку);
  2. wrong ⇒ ply 1 и by == to_move; correct — только на листьях;
  3. чередование цветов по всему дереву, корни ходят за to_move;
  4. полный реплей всех линий (главных и опровержений) капчур-движком:
     каждый ход легален (захваты, самоубийство, простое ко);
  5. дерево непустое и содержит ≥1 correct-путь;
  6. view покрывает все ходы дерева (и все камни доски — иначе Goban
     отрисует позицию без части камней).

Выход: сводка по классам + exit 1 при нарушениях (кроме --allow-known).
Запускать перед каждым merge разметки; известное исключение —
xuanxuan-qijing-346 (пустое дерево, вне адаптивного пула).
"""

import json
import sys
from pathlib import Path

KNOWN = {"xuanxuan-qijing-346"}  # пустое дерево; в пул не попадает
ALLOW_KNOWN = "--allow-known" in sys.argv

SGF = "abcdefghijklmnopqrs"


def sgf_to_idx(coord, size):
    return SGF.index(coord[1]) * size + SGF.index(coord[0])


def neighbors(i, size):
    c, r = i % size, i // size
    if c > 0: yield i - 1
    if c < size - 1: yield i + 1
    if r > 0: yield i - size
    if r < size - 1: yield i + size


def group_and_liberties(board, idx, size):
    color = board[idx]
    stack, group, libs = [idx], {idx}, set()
    while stack:
        cur = stack.pop()
        for n in neighbors(cur, size):
            if board[n] == ".":
                libs.add(n)
            elif board[n] == color and n not in group:
                group.add(n)
                stack.append(n)
    return group, libs


def play(board, idx, color, size, prev_board=None):
    """Ход с захватами; None если нелегален (занято/самоубийство/простое ко)."""
    if board[idx] != ".":
        return None
    b = list(board)
    b[idx] = color
    enemy = "w" if color == "b" else "b"
    captured = False
    for n in neighbors(idx, size):
        if b[n] == enemy:
            grp, libs = group_and_liberties(b, n, size)
            if not libs:
                for g in grp:
                    b[g] = "."
                captured = True
    _, own_libs = group_and_liberties(b, idx, size)
    if not own_libs and not captured:
        return None  # самоубийство
    out = "".join(b)
    if prev_board is not None and out == prev_board:
        return None  # простое ко: немедленный повтор позиции
    return out


def walk_audit(problem, issues):
    pid = problem["id"]
    size = problem.get("size") or 9
    to_move = problem["to_move"]
    tree = problem.get("tree") or []

    if not tree:
        issues.append((pid, "EMPTY_TREE", ""))
        return

    # 5: ≥1 correct-путь (не-wrong корень, чей лист дотегирован correct)
    def has_correct(nodes):
        for n in nodes:
            if n.get("tag") == "wrong":
                continue
            if n.get("tag") == "correct" and not n.get("children"):
                return True
            if n.get("children") and has_correct(n["children"]):
                return True
        return False

    if not has_correct(tree):
        issues.append((pid, "NO_CORRECT_PATH", ""))

    view = problem.get("view")

    def in_view(idx):
        if not view:
            return True
        c, r = idx % size, idx // size
        return view["c0"] <= c <= view["c1"] and view["r0"] <= r <= view["r1"]

    # 6: все камни доски внутри view
    for i, ch in enumerate(problem["board"]):
        if ch != "." and not in_view(i):
            issues.append((pid, "STONE_OUTSIDE_VIEW", f"idx={i}"))
            break

    def rec(node, depth, expect_by, board, prev, under_wrong):
        tag = node.get("tag")
        by = node["by"]
        children = node.get("children") or []

        # 2: wrong только на ply1 за решателя; correct только на листе
        if tag == "wrong":
            if depth != 1:
                issues.append((pid, "WRONG_DEEP", f"ply={depth}"))
            if by != to_move:
                issues.append((pid, "WRONG_BY_OPPONENT", node["at"]))
        if tag == "correct" and children:
            issues.append((pid, "CORRECT_NONLEAF", node["at"]))

        # 1: нетегированный лист обязан быть под wrong
        if not tag and not children and not under_wrong and tag != "wrong":
            issues.append((pid, "UNTAGGED_LEAF_MAINLINE", node["at"]))

        # 3: чередование
        if by != expect_by:
            issues.append((pid, "COLOR_ORDER", f"ply={depth} at={node['at']}"))

        # 6: ход внутри view
        idx = sgf_to_idx(node["at"], size)
        if not in_view(idx):
            issues.append((pid, "MOVE_OUTSIDE_VIEW", node["at"]))

        # 4: легальность
        nxt = play(board, idx, by, size, prev)
        if nxt is None:
            issues.append((pid, "ILLEGAL_MOVE", f"ply={depth} at={node['at']} by={by}"))
            return  # глубже эта линия не реиграется

        nxt_by = "w" if by == "b" else "b"
        for ch_node in children:
            rec(ch_node, depth + 1, nxt_by, nxt, board, under_wrong or tag == "wrong")

    for root in tree:
        rec(root, 1, to_move, problem["board"], None, False)


def main():
    root = Path(__file__).resolve().parent.parent
    paths = [
        root / "data/tsumego/problems.json",
        root / "apps/mobile/src/data/tsumego.json",
    ]
    fail = False
    for path in paths:
        db = json.loads(path.read_text())
        issues = []
        for p in db["problems"]:
            walk_audit(p, issues)
        material = [i for i in issues if not (ALLOW_KNOWN and i[0] in KNOWN)]
        by_class = {}
        for _, cls, _ in issues:
            by_class[cls] = by_class.get(cls, 0) + 1
        print(f"{path.relative_to(root)}: задач {len(db['problems'])}, "
              f"нарушений {len(issues)} {by_class or ''}")
        for pid, cls, detail in material[:20]:
            print(f"  {cls:24s} {pid} {detail}")
        if material:
            fail = True
    sys.exit(1 if fail else 0)


if __name__ == "__main__":
    main()
