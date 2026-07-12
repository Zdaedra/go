#!/usr/bin/env python3
"""Race (semeai) generator — solver is CORRECT, hand-built templates are NOT.

NEGATIVE RESULT: the two-group `_race_win` solver below is sound (it correctly
tracks both groups and rejects non-races), but the RACE_TEMPLATES here yield 0
certified — constructing a valid unique-key semeai by hand needs exact
liberty/shared-liberty geometry per shape, and there are no trusted race seeds
to tune against. Unlike ld (canonical nakade shapes with known vital points),
semeai has no small finite shape catalogue that drops in. Doing race right is a
dedicated tactical-shape effort (or a KataGo generate-and-filter sweep over many
positions). The solver is kept — feed it correct semeai shapes and it certifies.

Original design note:

A capturing race is NOT just "white is captured": BOTH groups are at risk, and
black wins only by capturing white while its OWN group survives. The solver
tracks a representative stone of each group and certifies:

  black wins  <=>  white group captured  AND  black group still on the board,

and — the race signature — that this flips with the tempo (white moving first
wins instead). That flip is what separates a race from a plain capture / a dead
group. Unique winning first move = the key. Trees are replayed in the app engine
before shipping; a KataGo-crop cross-check is available via verify.

Emits data/tsumego/generated/race.json.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from gen_tsumego import (  # noqa: E402
    N, _legal_moves, count, opp, neighbors, play, _place, _cr, _idx,
    idx_to_coord, render, board_from,
)


def _race_win(board, to_move, w_rep, b_rep, region, depth, memo):
    """Can BLACK force: white(w_rep) captured while black(b_rep) survives?"""
    if board[w_rep] == ".":
        return board[b_rep] != "."          # white gone: win iff black alive
    if board[b_rep] == ".":
        return False                         # black gone: lost the race
    if depth <= 0:
        return False
    key = ("".join(board), to_move, depth)
    if key in memo:
        return memo[key]
    if to_move == "b":
        res = any(_race_win(nb, "w", w_rep, b_rep, region, depth - 1, memo)
                  for _, nb in _legal_moves(board, "b", region))
    else:
        res = all(_race_win(nb, "b", w_rep, b_rep, region, depth - 1, memo)
                  for _, nb in _legal_moves(board, "w", region)) and \
            _race_win(board, "b", w_rep, b_rep, region, depth - 1, memo)  # pass
    memo[key] = res
    return res


def _region(board, depth):
    stones = [i for i, c in enumerate(board) if c != "."]
    ring = {nb for i in stones for nb in neighbors(i) if board[nb] == "."}
    ring2 = {nb for i in ring for nb in neighbors(i) if board[nb] == "."}
    return sorted(ring | ring2)


def certify_race(board, w_rep, b_rep, depth):
    """Unique winning first move for black, AND the race flips with tempo
    (white-first wins) — the signature that distinguishes a race from a plain
    capture. Returns (key_idx | None, pv_len)."""
    region = _region(board, depth)
    if not region or len(region) ** min(depth, 6) > 3_000_000:
        return None, 0
    # black to move: which first moves win the race?
    winners = []
    for idx, nb in _legal_moves(board, "b", region):
        if _race_win(nb, "w", w_rep, b_rep, region, depth - 1, {}):
            winners.append(idx)
    if len(winners) != 1:
        return None, 0
    # tempo flip: if WHITE moves first, black must NOT already win (else it's
    # not a race — white is just dead). White wins first <=> black can't win
    # when white leads.
    if _race_win(board, "w", w_rep, b_rep, region, depth, {}):
        return None, 0                       # black wins even giving white the move
    return winners[0], _pv_len(board, winners[0], w_rep, b_rep, region, depth)


def _pv_len(board, key, w_rep, b_rep, region, depth):
    nb = play(list(board), key, "b")
    length = 1
    cur, mover, d = nb, "w", depth - 1
    while cur is not None and count(cur, "w") > 0 and d > 0:
        nxt = None
        for _, cand in _legal_moves(cur, mover, region):
            if _race_win(cand, opp(mover), w_rep, b_rep, region, d - 1, {}) == (mover == "b"):
                nxt = cand
                break
        if nxt is None:
            break
        cur, mover, d, length = nxt, opp(mover), d - 1, length + 1
    return length


def build_race(board, w_rep, b_rep, depth):
    key, pv = certify_race(board, w_rep, b_rep, depth)
    if key is None or pv < 2:                # pv>=2 -> genuine multi-move race
        return None
    # correct line: follow black's winning race moves + white's best defense
    region = _region(board, depth)
    tree_moves = []
    cur, mover, d = list(board), "b", depth
    guard = 0
    while count(cur, "w") > 0 and d > 0 and guard < 20:
        guard += 1
        chosen = None
        want = (mover == "b")
        for idx, nb in _legal_moves(cur, mover, region):
            if mover == "b" and not tree_moves:
                if idx != key:
                    continue
            if _race_win(nb, opp(mover), w_rep, b_rep, region, d - 1, {}) == want:
                chosen = (idx, nb)
                break
        if chosen is None:
            break
        tree_moves.append((chosen[0], mover))
        cur, mover, d = chosen[1], opp(mover), d - 1
        if count(cur, "w") == 0:
            break
    if not tree_moves or count(cur, "w") > 0:
        return None                          # didn't actually capture
    # nest into a single correct line, last black move tagged correct
    node = None
    for idx, by in reversed(tree_moves):
        n = {"at": idx_to_coord(idx), "by": by}
        if node is not None:
            n["children"] = [node]
        elif by == "b":
            n["tag"] = "correct"
        node = n
    return {"to_move": "b", "board": "".join(board), "tree": [node],
            "pv_len": len(tree_moves)}


# black racing group + white target, with seal stones; b_rep/w_rep are the
# first cell of each racing group.
RACE_TEMPLATES = [
    # id, white(target+seal is black), black(group+seal is white), depth, base
    ("semeai-1out", ["ee", "ef"], ["de", "df", "fe", "ff", "eg", "ed"], 6, 1300),
    ("semeai-side", ["fb", "fc"], ["eb", "ec", "gb", "gc", "fd", "fa"], 6, 1280),
    ("oiotoshi", ["dc", "dd"], ["cc", "cd", "ec", "ed", "de", "db", "ce"], 7, 1400),
    ("approach", ["ed", "ee"], ["dd", "de", "fd", "fe", "ef", "ec"], 6, 1340),
]


def generate():
    seen, out = set(), []
    for tid, w_rel, b_rel, depth, base in RACE_TEMPLATES:
        w_cr = [_cr(c) for c in w_rel]
        b_cr = [_cr(c) for c in b_rel]
        made = 0
        for sym in range(8):
            for dy in range(-N, N):
                for dx in range(-N, N):
                    wp, bp = _place(w_cr, sym, dx, dy), _place(b_cr, sym, dx, dy)
                    if wp is None or bp is None:
                        continue
                    board = ["."] * (N * N)
                    ok = True
                    for (c, r) in wp:
                        if board[_idx(c, r)] != ".":
                            ok = False
                            break
                        board[_idx(c, r)] = "w"
                    for (c, r) in bp:
                        if not ok or board[_idx(c, r)] != ".":
                            ok = False
                            break
                        board[_idx(c, r)] = "b"
                    if not ok:
                        continue
                    kb = "".join(board)
                    if kb in seen:
                        continue
                    w_rep = _idx(*wp[0])
                    b_rep = _idx(*bp[0])
                    prob = build_race(board, w_rep, b_rep, depth)
                    if prob is None:
                        continue
                    seen.add(kb)
                    prob.update({"template": tid, "domain": "race",
                                 "difficulty": base + (prob["pv_len"] - 2) * 25})
                    out.append(prob)
                    made += 1
        print(f"  {tid:14s} -> {made} certified")
    return out


if __name__ == "__main__":
    print("=== race (semeai) ===")
    probs = generate()
    print(f"total: {len(probs)}")
    shown = set()
    for p in probs:
        if p["template"] in shown:
            continue
        shown.add(p["template"])
        print(f"[{p['template']}] diff={p['difficulty']} pv={p['pv_len']}")
        print(render(list(p["board"])))
    if probs:
        recs = []
        cnt = {}
        for p in probs:
            cnt[p["template"]] = cnt.get(p["template"], 0) + 1
            recs.append({
                "id": f"gen-race-{p['template']}-{cnt[p['template']]:03d}",
                "category": "race", "section": "semeai", "title": "Гонка свобод",
                "to_move": "b", "size": N, "board": p["board"], "domain": "race",
                "difficulty": p["difficulty"], "tree": p["tree"],
                "scaleVersion": "v2-2026-07-11",
                "marked_by": {"engine": "gen+semeai-solver", "template": p["template"]},
            })
        path = Path(__file__).resolve().parent.parent / "data/tsumego/generated/race.json"
        path.write_text(json.dumps({
            "board_size": N, "source": "procedurally generated semeai, solver-certified",
            "categories": [{"id": "race", "title": "Гонка свобод",
                            "sections": [{"id": "semeai", "title": "Семеай"}]}],
            "problems": recs}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"emitted {len(recs)} -> {path}")
