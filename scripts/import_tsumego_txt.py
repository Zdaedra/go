#!/usr/bin/env python3
"""Import classical tsumego collections from travisgk/tsumego-pdf book files.

Sources used (public-domain classics only; the modern Cho Chikun
encyclopedia files present in that repo are deliberately NOT imported):
  - gokyo-shumyo.txt      (Gokyo Shumyo, 1812) — 7 themed sections
  - xuanxuan-qijing.txt   (Xuanxuan Qijing, 1349)
  - igo-hatsuyoron.txt    (Igo Hatsuyoron, 1713)

Text format (decoded from that repo's MIT-licensed parser):
  each char is a board point of a top-left-anchored crop of a 19x19 board;
  '@' black, '!' white, 'X' solution move 1, digits 2-9 further solution
  moves (colors alternate from the side to play), all of '<>[]()+*' are
  empty points. 'problem N[-M], black|white to play' lines close a problem.

Problems are imported on a full 19x19 board with a `view` rectangle for
the app's cropped rendering. Where the source marks a solution sequence it
becomes a linear tree (auto-checked in the app) and is verified by
replaying it with the capture engine; problems without marks get an empty
tree and run in the app's free-solve mode with manual self-check.

Usage:
    python3 scripts/import_tsumego_txt.py <path-to-tsumego-pdf-repo>
"""

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

SIZE = 19
EMPTY_CHARS = set("<>[]()+*")
VIEW_MARGIN = 2

GOKYO_SECTIONS = {
    1: ("living", "Жизнь"),
    2: ("killing", "Убийство"),
    3: ("ko", "Ко"),
    4: ("capturing-race", "Гонка захвата"),
    5: ("oiotoshi", "Ойотоси"),
    6: ("connecting", "Соединение"),
    7: ("various", "Разное"),
}

PROBLEM_RE = re.compile(r"problem\s+(\d+)(?:-(\d+))?,\s*(black|white) to play")


def neighbors(i):
    r, c = divmod(i, SIZE)
    if r > 0:
        yield i - SIZE
    if r < SIZE - 1:
        yield i + SIZE
    if c > 0:
        yield i - 1
    if c < SIZE - 1:
        yield i + 1


def group_liberties(board, idx):
    color = board[idx]
    seen, stack, libs = {idx}, [idx], 0
    while stack:
        cur = stack.pop()
        for nb in neighbors(cur):
            if board[nb] == ".":
                libs += 1
            elif board[nb] == color and nb not in seen:
                seen.add(nb)
                stack.append(nb)
    return libs, seen


def play(board, idx, color):
    if board[idx] != ".":
        return None
    board = board[:]
    board[idx] = color
    enemy = "w" if color == "b" else "b"
    captured = 0
    for nb in neighbors(idx):
        if board[nb] == enemy:
            libs, stones = group_liberties(board, nb)
            if libs == 0:
                for s in stones:
                    board[s] = "."
                captured += len(stones)
    if captured == 0 and group_liberties(board, idx)[0] == 0:
        return None
    return board


def flip_horizontally(rows):
    width = max(len(r) for r in rows)
    return [r.ljust(width, "+")[::-1] for r in rows]


def parse_book(path: Path, flip: bool):
    """Yield (section_num, problem_num, to_move, rows[list of str])."""
    rows = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line:
            continue
        if len(line) <= 3 and line[0].isdigit():
            rows = []  # page number; a duplicate rendering precedes it
            continue
        m = PROBLEM_RE.match(line)
        if m:
            sec = int(m.group(1)) if m.group(2) else None
            num = int(m.group(2) or m.group(1))
            to_move = "b" if m.group(3) == "black" else "w"
            out = flip_horizontally(rows) if flip else rows
            yield sec, num, to_move, out
            rows = []
        else:
            rows.extend(line.split(" "))


def decode(rows):
    """Return (stones {(c,r): color}, solution [(n,(c,r))]) or None."""
    stones, solution = {}, []
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch in EMPTY_CHARS:
                continue
            if c >= SIZE or r >= SIZE:
                return None
            if ch == "@":
                stones[(c, r)] = "b"
            elif ch == "!":
                stones[(c, r)] = "w"
            elif ch == "X":
                solution.append((1, (c, r)))
            elif ch.isdigit():
                solution.append((int(ch), (c, r)))
            else:
                return None  # circled-numeral glyphs etc. — skip problem
    if not stones:
        return None
    solution.sort()
    if solution and [n for n, _ in solution] != list(range(1, len(solution) + 1)):
        solution = []  # incomplete numbering: keep position, drop the tree
    return stones, solution


def build_problem(pid, category, section, title, to_move, stones, solution):
    cells = ["."] * (SIZE * SIZE)
    for (c, r), color in stones.items():
        cells[r * SIZE + c] = color
    other = "w" if to_move == "b" else "b"
    tree = None
    for n, (c, r) in reversed(solution):
        coord = chr(97 + c) + chr(97 + r)
        by = to_move if n % 2 == 1 else other
        node = {"at": coord, "by": by}
        if tree is None:
            node["tag"] = "correct"
        else:
            node["children"] = [tree]
        tree = node

    pts = list(stones) + [p for _, p in solution]
    c0 = max(0, min(c for c, _ in pts) - VIEW_MARGIN)
    r0 = max(0, min(r for _, r in pts) - VIEW_MARGIN)
    c1 = min(SIZE - 1, max(c for c, _ in pts) + VIEW_MARGIN)
    r1 = min(SIZE - 1, max(r for _, r in pts) + VIEW_MARGIN)

    return {
        "id": pid,
        "category": category,
        "section": section,
        "title": title,
        "to_move": to_move,
        "size": SIZE,
        "view": {"c0": c0, "r0": r0, "c1": c1, "r1": r1},
        "board": "".join(cells),
        "tree": [tree] if tree else [],
        "hint": None,
    }


def verify(problem):
    """Replay the solution line with captures; every move must be legal."""
    board = list(problem["board"])
    node = problem["tree"][0] if problem["tree"] else None
    while node:
        c, r = ord(node["at"][0]) - 97, ord(node["at"][1]) - 97
        board = play(board, r * SIZE + c, node["by"])
        if board is None:
            return False
        node = (node.get("children") or [None])[0]
    return True


def chunk_sections(problems, size=50):
    out = []
    for i in range(0, len(problems), size):
        chunk = problems[i:i + size]
        out.append((f"p{i + 1}-{i + len(chunk)}", f"Задачи {i + 1}–{i + len(chunk)}", chunk))
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    books = Path(sys.argv[1]) / "tsumego_pdf" / "puzzles" / "books"

    stats = {}
    categories, problems_out = [], []

    def add_category(cat_id, cat_title, sections):
        entry = {"id": cat_id, "title": cat_title, "sections": []}
        for sec_id, sec_title, probs in sections:
            entry["sections"].append({"id": sec_id, "title": sec_title})
            problems_out.extend(probs)
        categories.append(entry)

    # --- Gokyo Shumyo: keep its own 7 thematic sections -----------------
    by_section = {}
    total = skipped = bad = with_tree = 0
    for sec, num, to_move, rows in parse_book(books / "gokyo-shumyo.txt", flip=False):
        total += 1
        decoded = decode(rows)
        if decoded is None:
            skipped += 1
            continue
        sec_id, sec_title = GOKYO_SECTIONS[sec]
        p = build_problem(
            f"gokyo-{sec_id}-{num:03d}", "gokyo-shumyo", sec_id,
            f"Гокё Сюмё {sec}-{num}", to_move, *decoded,
        )
        if not verify(p):
            bad += 1
            continue
        with_tree += bool(p["tree"])
        by_section.setdefault(sec, []).append(p)
    add_category(
        "gokyo-shumyo", "Классика: Гокё Сюмё (1812)",
        [(GOKYO_SECTIONS[s][0], GOKYO_SECTIONS[s][1], probs)
         for s, probs in sorted(by_section.items())],
    )
    stats["gokyo-shumyo"] = (total, skipped, bad, with_tree)

    # --- Xuanxuan Qijing and Igo Hatsuyoron: range sections --------------
    for fname, cat_id, cat_title, flip in [
        ("xuanxuan-qijing.txt", "xuanxuan-qijing", "Классика: Сюаньсюань Цицзин (1349)", False),
        ("igo-hatsuyoron.txt", "igo-hatsuyoron", "Классика: Иго Хацуёрон (1713)", True),
    ]:
        total = skipped = bad = with_tree = 0
        kept = []
        for _, num, to_move, rows in parse_book(books / fname, flip=flip):
            total += 1
            decoded = decode(rows)
            if decoded is None:
                skipped += 1
                continue
            p = build_problem(
                f"{cat_id}-{num:03d}", cat_id, "tmp", f"№{num}", to_move, *decoded,
            )
            if not verify(p):
                bad += 1
                continue
            with_tree += bool(p["tree"])
            kept.append(p)
        sections = chunk_sections(kept)
        for sec_id, _, probs in sections:
            for p in probs:
                p["section"] = sec_id
        add_category(cat_id, cat_title, sections)
        stats[cat_id] = (total, skipped, bad, with_tree)

    # --- merge into the app database -------------------------------------
    cat_ids = {c["id"] for c in categories}
    for out_path in [
        Path("apps/mobile/src/data/tsumego.json"),
        Path("data/tsumego/problems.json"),
    ]:
        db = json.loads(out_path.read_text(encoding="utf-8"))
        db["categories"] = [c for c in db["categories"] if c["id"] not in cat_ids]
        db["categories"].extend(categories)
        db["problems"] = [p for p in db["problems"] if p["category"] not in cat_ids]
        db["problems"].extend(problems_out)
        db["source"] = (
            "seed shapes + classical public-domain collections "
            "(Gokyo Shumyo 1812, Xuanxuan Qijing 1349, Igo Hatsuyoron 1713); "
            "position encodings from the MIT-licensed travisgk/tsumego-pdf"
        )
        out_path.write_text(json.dumps(db, ensure_ascii=False, indent=1), encoding="utf-8")

    for name, (total, skipped, bad, with_tree) in stats.items():
        kept = total - skipped - bad
        print(f"{name:18s} total={total:4d} imported={kept:4d} auto-checked={with_tree:3d} "
              f"skipped={skipped:3d} failed-verify={bad}")
    print(f"imported problems: {len(problems_out)} (+ seed set)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
