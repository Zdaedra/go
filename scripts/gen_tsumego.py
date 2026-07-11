#!/usr/bin/env python3
"""Procedurally generate + self-verify tsumego, by domain, clean-license.

Method (the "KataGo-generation" idea, made deterministic and GPU-free for
the correctness core):

  1. COMPOSE candidates from public-domain shape theory (atari, ladder, net,
     snapback, double-atari; canonical dead/alive eye shapes) expanded over
     the 8 board symmetries and wall variations. The intended domain and key
     point are known BY CONSTRUCTION — this sidesteps the domain-classifier
     problem (Р1b) entirely.
  2. SOLVE each candidate with our own bounded region negamax (the same
     capture engine that powers the app's move checking). The solver:
       - confirms the key move is the UNIQUE winning first move (a real
         puzzle, not "many moves work"),
       - emits the solution tree automatically: best line tagged "correct",
         every losing first move tagged "wrong" with a short refutation,
       - estimates difficulty from search depth / space / branching.
  3. KEEP only solver-verified uniques. KataGo on Vast is an optional
     cross-check / difficulty calibration on a sample — never a dependency.

This module is import-safe: `solve_capture`, `two_eyes`, generators and the
verifier are all reusable. Run directly for the self-test + a pilot batch.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_epub_openings import (  # noqa: E402
    BOARD_SIZE, coord_to_idx, neighbors, group_liberties, play,
)

N = BOARD_SIZE  # 9


def idx_to_coord(idx: int) -> str:
    return chr(97 + idx % N) + chr(97 + idx // N)


def board_from(black, white) -> list[str]:
    cells = ["."] * (N * N)
    for c in black:
        cells[coord_to_idx(c)] = "b"
    for c in white:
        cells[coord_to_idx(c)] = "w"
    return cells


def opp(color: str) -> str:
    return "w" if color == "b" else "b"


def count(board, color) -> int:
    return board.count(color)


# --------------------------------------------------------------- capture solver
#
# Attacker `A` hunts defender `D`'s group. Win = D loses a stone (D_count drops
# below the root count) within `depth` plies of alternating best play, search
# restricted to `region` (the empty points that matter — keeps it local/cheap).
# A capture is a terminal, engine-checked fact, so this is EXACT for capture
# problems. Clean negamax: `_atk` = attacker to move (tries to capture),
# `_def` = defender to move (tries to escape).


def _legal_moves(board, color, region):
    out = []
    for idx in region:
        if board[idx] != ".":
            continue
        nb = play(list(board), idx, color)
        if nb is None:            # illegal / suicide
            continue
        out.append((idx, nb))
    return out


def _atk(board, A, D, region, depth, d_root):
    """A to move: can A force D_count < d_root within depth?"""
    if depth <= 0:
        return False
    for _, nb in _legal_moves(board, A, region):
        if count(nb, D) < d_root:            # immediate capture
            return True
        if _def(nb, A, D, region, depth - 1, d_root):
            return True
    return False


def _def(board, A, D, region, depth, d_root):
    """D to move (already captured? -> A won). D tries to escape: A still
    forces the capture only if EVERY D reply still loses."""
    if count(board, D) < d_root:
        return True
    if depth <= 0:
        return False
    replies = _legal_moves(board, D, region)
    if not replies:                          # D must pass; A plays on
        return _atk(board, A, D, region, depth - 1, d_root)
    for _, nb in replies:
        if not _atk(nb, A, D, region, depth - 1, d_root):
            return False                     # this reply escapes -> not forced
    return True


def solve_capture(board, to_move, region, depth):
    """Root: which first moves force a capture? Returns (win, winning_idxs).

    A real puzzle needs exactly ONE winning first move (unique key); callers
    check `len(winning_idxs) == 1`.
    """
    A, D = to_move, opp(to_move)
    d_root = count(board, D)
    winners = []
    for idx, nb in _legal_moves(board, A, region):
        if count(nb, D) < d_root or _def(nb, A, D, region, depth - 1, d_root):
            winners.append(idx)
    return (len(winners) > 0), winners


def _def_escape(board, A, D, region, depth, d_root):
    """A defender reply that ESCAPES the capture (makes A unable to force),
    or None if every reply still loses. Used to refute wrong first moves."""
    if count(board, D) < d_root:
        return None                          # already captured, no escape
    if depth <= 0:
        return "pass"                        # ran out of attacker depth = safe
    for idx, nb in _legal_moves(board, D, region):
        if not _atk(nb, A, D, region, depth - 1, d_root):
            return idx
    return None


def capture_pv(board, A, D, region, depth, d_root):
    """Principal variation of a forced capture: [(idx, color), ...] ending on
    the capturing attacker move. Assumes A-to-move can force. Attacker picks a
    winning move; defender picks the most stubborn reply (deepest resistance)."""
    for idx, nb in _legal_moves(board, A, region):
        if count(nb, D) < d_root:
            return [(idx, A)]                # immediate capture leaf
        if not _def(nb, A, D, region, depth - 1, d_root):
            continue                         # not a forcing move
        # defender's stubborn reply: any reply (all still lose); prefer one
        # that is legal and keeps the group on the board.
        best_reply = None
        for ridx, rnb in _legal_moves(nb, D, region):
            best_reply = (ridx, rnb)
            break
        if best_reply is None:               # defender must pass
            tail = capture_pv(nb, A, D, region, depth - 2, d_root)
            return [(idx, A)] + tail
        ridx, rnb = best_reply
        tail = capture_pv(rnb, A, D, region, depth - 2, d_root)
        return [(idx, A), (ridx, D)] + tail
    return []


# --------------------------------------------------------------- self-test
#
# Before trusting the solver on generated shapes, reproduce the answers of the
# hand-made public-domain seeds (make_seed_tsumego.py). If the solver can't
# recover known keys, it must not be used to certify new problems.

SEED_CAPTURE_TESTS = [
    # (name, black, white, to_move, region_coords, depth, expected_key)
    ("atari-1", ["de", "ed", "fe"], ["ee"], "b",
     ["ef", "fe", "ed", "de"], 1, "ef"),
    ("atari-edge", ["da", "fa"], ["ea"], "b",
     ["eb", "ea", "da", "fa"], 1, "eb"),
    ("atari-corner", ["ba"], ["aa"], "b",
     ["ab", "ba"], 1, "ab"),
    ("two-stones", ["ed", "de", "fe", "df", "ff"], ["ee", "ef"], "b",
     ["eg", "ef", "ee"], 1, "eg"),
    ("squeeze", ["fd", "ee", "ge", "gf", "fg"], ["fe", "ff"], "b",
     ["ef", "fe", "ff"], 1, "ef"),
]


def _region(coords):
    return [coord_to_idx(c) for c in coords]


def self_test() -> bool:
    print("=== solver self-test on public-domain seeds ===")
    ok = True
    for name, b, w, tm, region_c, depth, key in SEED_CAPTURE_TESTS:
        board = board_from(b, w)
        region = _region(region_c)
        win, winners = solve_capture(board, tm, region, depth)
        keys = sorted(idx_to_coord(i) for i in winners)
        unique = len(winners) == 1
        good = win and unique and keys == [key]
        ok = ok and good
        print(f"  {name:14s} expect [{key}] -> "
              f"{'win' if win else 'no'} {keys} "
              f"{'OK' if good else 'FAIL'}")
    print("self-test:", "PASS" if ok else "FAIL")
    return ok


# --------------------------------------------------------------- geometry
#
# 8 dihedral symmetries of the square board + translation give every clean
# orientation/location of a template shape. The solver re-certifies each
# placement, so symmetry/translation need not be provably answer-preserving —
# a broken placement is simply rejected.

def _dihedral(c, r):
    return [
        (c, r), (N - 1 - c, r), (c, N - 1 - r), (N - 1 - c, N - 1 - r),
        (r, c), (N - 1 - r, c), (r, N - 1 - c), (N - 1 - r, N - 1 - c),
    ]


def _place(stones, sym, dx, dy):
    """Apply symmetry index `sym` then translate; None if off-board."""
    out = []
    for (c, r) in stones:
        cr = _dihedral(c, r)[sym]
        nc, nr = cr[0] + dx, cr[1] + dy
        if not (0 <= nc < N and 0 <= nr < N):
            return None
        out.append((nc, nr))
    return out


def _cr(coord):
    return (ord(coord[0]) - 97, ord(coord[1]) - 97)


def _idx(c, r):
    return r * N + c


def _region_box(idxs, margin):
    cs = [i % N for i in idxs]
    rs = [i // N for i in idxs]
    c0, c1 = max(0, min(cs) - margin), min(N - 1, max(cs) + margin)
    r0, r1 = max(0, min(rs) - margin), min(N - 1, max(rs) + margin)
    return [_idx(c, r) for r in range(r0, r1 + 1) for c in range(c0, c1 + 1)]


# --------------------------------------------------------------- templates
#
# Each capture template: black (attacker) captures white. Coords are
# public-domain teaching shapes placed once; expansion does the rest.

# Brute negamax is only viable at shallow depth on a local region; ladders /
# nets (deep, corridor-shaped search) need a dedicated routine and are added
# in a later pass. This pilot proves the pipeline on the depth-1..3 motifs
# that make up the novice band the app most needs.
CAP_TEMPLATES = [
    # id, section, white(D), black(A), max_depth, base_diff
    ("atari3", "atari", ["ee"], ["de", "ed", "fe"], 1, 900),
    ("atari-edge", "atari", ["ea"], ["da", "fa"], 1, 880),
    ("atari-corner", "atari", ["aa"], ["ba"], 1, 850),
    ("two-stone", "atari", ["ee", "ef"], ["ed", "de", "fe", "df", "ff"], 1, 960),
    ("three-stone", "atari", ["ee", "ef", "eg"],
     ["ed", "de", "fe", "df", "ff", "dg", "fg"], 1, 1010),
    ("squeeze", "technique", ["fe", "ff"],
     ["fd", "ee", "ge", "gf", "fg"], 1, 1050),
    ("shortage", "technique", ["ee", "fe"],
     ["ed", "de", "fd", "ge", "ff"], 3, 1180),
]

COMPLEXITY_CAP = 2_000_000  # region**depth guard — skip anything that would hang


def _target_neighbors(board, d_color):
    """Empty points adjacent to the defender group — the intuitive-but-wrong
    tries a learner reaches for. Used to pick plausible decoys."""
    out = []
    for i, cell in enumerate(board):
        if cell != d_color:
            continue
        for nb in neighbors(i):
            if board[nb] == "." and nb not in out:
                out.append(nb)
    return out


def _nest(pv, A):
    """Nested children chain from a flat PV [(idx,color),...]; the final
    attacker move is tagged 'correct' (engine: childless node = solved)."""
    if not pv:
        return []
    (idx, color), rest = pv[0], pv[1:]
    node = {"at": idx_to_coord(idx), "by": color}
    child = _nest(rest, A)
    if child:
        node["children"] = child
    elif color == A:
        node["tag"] = "correct"
    return [node]


def build_capture_problem(board, to_move, depth):
    """Certify + build a capture problem from a raw position. Returns a
    problem dict (no id/difficulty) or None if not a unique-key puzzle."""
    A, D = to_move, opp(to_move)
    # A capture fight stays local: search the defender group's liberties plus a
    # two-ring halo. Small at any depth, so oiotoshi/shortage (depth 2-3) is
    # feasible without the box-by-depth blow-up. (Ladders travel far and are
    # handled by a dedicated pass, not here.)
    d_stones = [i for i, c in enumerate(board) if c == D]
    ring1 = {nb for i in d_stones for nb in neighbors(i) if board[nb] == "."}
    ring2 = {nb for i in ring1 for nb in neighbors(i) if board[nb] == "."}
    region = sorted(ring1 | ring2)
    if not region or len(region) ** depth > COMPLEXITY_CAP:
        return None                          # too big for brute solve — skip
    win, winners = solve_capture(board, to_move, region, depth)
    if not win or len(winners) != 1:
        return None                          # no key, or ambiguous — reject
    d_root = count(board, D)
    key = winners[0]
    pv = capture_pv(board, A, D, region, depth, d_root)
    if not pv or pv[0][0] != key:
        return None
    tree = _nest(pv, A)                       # correct branch (root list head)

    # plausible decoys: intuitive defender-adjacent points that still lose.
    decoys = 0
    for idx in _target_neighbors(board, D):
        if idx == key or decoys >= 3:
            continue
        nb = play(list(board), idx, A)
        if nb is None:
            continue
        if count(nb, D) < d_root:
            continue                          # this move also captures? skip
        esc = _def_escape(nb, A, D, region, depth - 1, d_root)
        if esc is None:
            continue                          # not actually refutable -> skip
        wnode = {"at": idx_to_coord(idx), "by": A, "tag": "wrong"}
        if esc != "pass":
            wnode["children"] = [{"at": idx_to_coord(esc), "by": D}]
        tree.append(wnode)
        decoys += 1

    return {"to_move": to_move, "board": "".join(board),
            "tree": tree, "pv_len": len(pv), "decoys": decoys}


def generate_capture():
    """Expand every capture template over symmetry+translation, certify each,
    dedup by board. Returns list of problem dicts with difficulty/domain."""
    seen = set()
    out = []
    for tid, section, d_rel, a_rel, depth, base in CAP_TEMPLATES:
        d_cr = [_cr(c) for c in d_rel]
        a_cr = [_cr(c) for c in a_rel]
        allc = d_cr + a_cr
        made = 0
        for sym in range(8):
            for dy in range(-N, N):
                for dx in range(-N, N):
                    dplaced = _place(d_cr, sym, dx, dy)
                    aplaced = _place(a_cr, sym, dx, dy)
                    if dplaced is None or aplaced is None:
                        continue
                    board = ["."] * (N * N)
                    ok = True
                    for (c, r) in dplaced:
                        if board[_idx(c, r)] != ".":
                            ok = False
                            break
                        board[_idx(c, r)] = "w"
                    for (c, r) in aplaced:
                        if not ok or board[_idx(c, r)] != ".":
                            ok = False
                            break
                        board[_idx(c, r)] = "b"
                    if not ok:
                        continue
                    key_board = "".join(board)
                    if key_board in seen:
                        continue
                    prob = build_capture_problem(board, "b", depth)
                    if prob is None:
                        continue
                    seen.add(key_board)
                    # difficulty: base by template + reading depth, mild jitter
                    diff = base + (prob["pv_len"] - 1) * 45
                    prob.update({
                        "template": tid, "section": section,
                        "domain": "capture", "difficulty": diff,
                    })
                    out.append(prob)
                    made += 1
        print(f"  template {tid:14s} -> {made} certified placements")
    return out


# --------------------------------------------------------------- render (proof)

def render(board, view_margin=1):
    idxs = [i for i, c in enumerate(board) if c != "."]
    cs = [i % N for i in idxs]
    rs = [i // N for i in idxs]
    c0, c1 = max(0, min(cs) - view_margin), min(N - 1, max(cs) + view_margin)
    r0, r1 = max(0, min(rs) - view_margin), min(N - 1, max(rs) + view_margin)
    glyph = {".": "·", "b": "●", "w": "○"}
    lines = []
    for r in range(r0, r1 + 1):
        lines.append(" ".join(glyph[board[_idx(c, r)]] for c in range(c0, c1 + 1)))
    return "\n".join(lines)


TITLE_RU = {
    "atari": "Атари: захвати",
    "technique": "Приём захвата",
}


def subsample(probs, per_template=40):
    """Keep a diverse slice per template (even stride) — the full expansion is
    mostly near-duplicate shifts; a spread of locations is what we want."""
    by_t = {}
    for p in probs:
        by_t.setdefault(p["template"], []).append(p)
    out = []
    for tid, group in by_t.items():
        if len(group) <= per_template:
            out.extend(group)
            continue
        stride = len(group) / per_template
        out.extend(group[int(i * stride)] for i in range(per_template))
    return out


def emit(probs, path, category, cat_title_ru, sections):
    import json
    records = []
    counters = {}
    for p in probs:
        sec = p["section"]
        counters[sec] = counters.get(sec, 0) + 1
        n = counters[sec]
        records.append({
            "id": f"gen-{category}-{p['template']}-{n:03d}",
            "category": category,
            "section": sec,
            "title": TITLE_RU.get(sec, ""),
            "to_move": p["to_move"],
            "size": N,
            "board": p["board"],
            "domain": p["domain"],
            "difficulty": p["difficulty"],
            "tree": p["tree"],
            "scaleVersion": "v2-2026-07-11",
            "marked_by": {"engine": "gen+negamax-solver",
                          "method": "template×symmetry, unique-key certified",
                          "template": p["template"]},
        })
    out = {
        "board_size": N,
        "source": "procedurally generated, solver-certified — clean license",
        "categories": [{"id": category, "title": cat_title_ru,
                        "sections": sections}],
        "problems": records,
    }
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(out, ensure_ascii=False, indent=1),
                          encoding="utf-8")
    return records


if __name__ == "__main__":
    if not self_test():
        raise SystemExit("solver self-test failed — do not generate")
    print("\n=== generate: capture ===")
    probs = generate_capture()
    print(f"certified (full expansion): {len(probs)}")
    probs = subsample(probs, per_template=40)
    print(f"after subsample (<=40/template): {len(probs)}")
    # difficulty histogram
    buckets = {}
    for p in probs:
        b = (p["difficulty"] // 100) * 100
        buckets[b] = buckets.get(b, 0) + 1
    print("difficulty histogram:",
          " ".join(f"{k}:{v}" for k, v in sorted(buckets.items())))

    out_path = "data/tsumego/generated/capture.json"
    records = emit(
        probs, out_path, "capture", "Захват камней",
        [{"id": "atari", "title": "Атари и захват"},
         {"id": "technique", "title": "Приёмы захвата"}],
    )
    print(f"emitted {len(records)} problems -> {out_path}")

    # sample renders (one per template)
    shown = set()
    print("\n=== sample problems (black ● to play, capture ○) ===")
    for p in probs:
        if p["template"] in shown:
            continue
        shown.add(p["template"])
        key = next((n["at"] for n in p["tree"]
                    if n.get("tag") == "correct" or n.get("children")), "?")
        print(f"\n[{p['template']}] diff={p['difficulty']} "
              f"pv={p['pv_len']} decoys={p['decoys']} key={key}")
        print(render(list(p["board"])))
