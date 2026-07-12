#!/usr/bin/env python3
"""Generate ENCLOSED life & death candidates; KataGo solves them (crop oracle).

Key idea: we do NOT need to know the vital point. We build valid enclosed
eye-shapes (a white group whose only liberties are an interior eye-space,
walled in by black + the board edge) and let KataGo — cropped onto the shape's
own tiny board — find the answer:

  - attacker (black) to move: best move = the killing vital point (if the shape
    is killable), winrate decisive for black;
  - defender (white) to move: best move = the living vital point, winrate
    decisive for white.

A shape is a real vital-point problem iff BOTH sides are decisive and opposite
(defender-first lives, attacker-first dies) — then it yields one ld-kill and
one ld-live problem sharing that vital point. Shapes that are always-alive or
always-dead are dropped. This stage only emits CANDIDATES + crop metadata;
scripts/verify_ld_katago.py runs KataGo and writes the solved problems.

Clean license: eye-shapes are public-domain nakade theory, constructed here.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gen_tsumego import (  # noqa: E402  (shared board helpers)
    N, board_from, idx_to_coord, neighbors, _dihedral, _place, _cr, _idx,
    render,
)

# Eye-space shapes (relative cells) — canonical nakade with a single vital
# point (public-domain L&D theory). `vital` = index into cells of the killing/
# living point. Square-2x2 / big spaces excluded (no unique vital point).
EYE_SHAPES = {
    # name: (cells, base_difficulty, vital_index)
    "straight3": ([(0, 0), (1, 0), (2, 0)], 1120, 1),            # middle
    "bent3":     ([(0, 0), (1, 0), (1, 1)], 1100, 1),            # the bend
    "pyramid4":  ([(0, 0), (1, 0), (2, 0), (1, 1)], 1260, 1),    # center (deg 3)
    "bulky5":    ([(0, 0), (1, 0), (0, 1), (1, 1), (2, 1)], 1420, 3),  # center
}


def _neighbors8(idx):
    c, r = idx % N, idx // N
    out = []
    for dc in (-1, 0, 1):
        for dr in (-1, 0, 1):
            if dc == 0 and dr == 0:
                continue
            nc, nr = c + dc, r + dr
            if 0 <= nc < N and 0 <= nr < N:
                out.append(nr * N + nc)
    return out


def build_enclosed(eye_idxs):
    """White inner wall around the eye-space, black outer wall around white.
    The inner wall uses the 8-neighbourhood so its corners connect (an edge
    straight-three otherwise leaves a detached end stone). Returns
    (board_list, white_idxs) or None if it can't be cleanly enclosed."""
    eye = set(eye_idxs)
    white = set()
    for e in eye:
        for nb in _neighbors8(e):        # 8-nbhd -> connected ring incl. corners
            if nb not in eye:
                white.add(nb)
    if eye & white:
        return None
    black = set()
    for w in white:
        for nb in neighbors(w):          # layer 1: seal white's orthogonal libs
            if nb not in eye and nb not in white:
                black.add(nb)
    # layer 2: thicken the wall so it survives cropping (a 1-stone wall, cut
    # off from the open board by the crop, has no liberties and KataGo removes
    # it — a thick wall keeps its liberties in the crop margin).
    for b in list(black):
        for nb in neighbors(b):
            if nb not in eye and nb not in white and nb not in black:
                black.add(nb)
    board = ["."] * (N * N)
    for i in white:
        board[i] = "w"
    for i in black:
        board[i] = "b"
    for i in eye:
        board[i] = "."
    return board, white


def _white_liberties(board, white):
    libs = set()
    for w in white:
        for nb in neighbors(w):
            if board[nb] == ".":
                libs.add(nb)
    return libs


def _connected(idxs):
    """Are these stones one orthogonally-connected group?"""
    idxs = set(idxs)
    if not idxs:
        return False
    start = next(iter(idxs))
    seen, stack = {start}, [start]
    while stack:
        j = stack.pop()
        for nb in neighbors(j):
            if nb in idxs and nb not in seen:
                seen.add(nb)
                stack.append(nb)
    return seen == idxs


def valid_enclosed(board, white, eye):
    """White is one group whose ONLY liberties are exactly the eye-space, and
    there is a black wall (so KataGo, cropped, sees a genuinely enclosed group)."""
    if not _connected(white):
        return False
    libs = _white_liberties(board, white)
    if libs != set(eye):
        return False
    if "b" not in board:
        return False
    return True


def generate_candidates():
    seen = set()
    out = []
    for name, (cells, base, vital_ix) in EYE_SHAPES.items():
        made = 0
        for sym in range(8):
            for dy in range(-N, N):
                for dx in range(-N, N):
                    placed = _place(list(cells), sym, dx, dy)
                    if placed is None:
                        continue
                    eye_idxs = [_idx(c, r) for (c, r) in placed]
                    built = build_enclosed(eye_idxs)
                    if built is None:
                        continue
                    board, white = built
                    if not valid_enclosed(board, white, eye_idxs):
                        continue
                    key = "".join(board)
                    if key in seen:
                        continue
                    seen.add(key)
                    out.append({
                        "shape": name, "difficulty": base,
                        "board": key, "size": N,
                        "eye": sorted(idx_to_coord(i) for i in eye_idxs),
                        "vital": idx_to_coord(eye_idxs[vital_ix]),
                    })
                    made += 1
        print(f"  {name:10s} -> {made} enclosed placements")
    return out


if __name__ == "__main__":
    print("=== generate enclosed L&D candidates ===")
    cands = generate_candidates()
    print(f"total candidates: {len(cands)}")
    out_path = Path(__file__).resolve().parent.parent / \
        "data/tsumego/generated/ld_candidates.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps({"candidates": cands}, ensure_ascii=False),
                        encoding="utf-8")
    print(f"wrote {out_path}")
    # render one per shape for eyeballing
    shown = set()
    for c in cands:
        if c["shape"] in shown:
            continue
        shown.add(c["shape"])
        print(f"\n[{c['shape']}] diff={c['difficulty']} eye={c['eye']} "
              f"(● black wall, ○ white group, · eye-space)")
        print(render(list(c["board"])))
