#!/usr/bin/env python3
"""Evaluate every opening-book position with KataGo.

Walks the canonical position index of the 9x9 openings database
(apps/mobile/src/data/branches.json), asks a KataGo analysis engine to
score each position, and records:

  - the engine's top moves (move, winrate, scoreLead) — the app's
    "best move" hint becomes a real KataGo recommendation;
  - an evaluation for EVERY book continuation at that position (the
    next line move of each branch passing through, and the lettered /
    triangled continuations on final diagrams), so each book move is
    individually verified against the engine. Book moves the root
    search did not visit are re-searched with the move forced.

Results are checkpointed per (position, side-to-move) unit in
data/openings/evals/ so the batch can be stopped and resumed anywhere.

Usage (GPU box):
    python3 scripts/eval_openings_katago.py \
        --katago /root/katago/squashfs-root/AppRun \
        --model /root/katago/network.bin.gz \
        --config /root/katago/analysis_fast.cfg \
        [--visits 800] [--limit N] [--db branches.json] [--out evals_dir]

Merge + verification report (locally, repo root):
    python3 scripts/eval_openings_katago.py --merge
      -> apps/mobile/src/data/opening_evals.json + mismatch report
"""

import argparse
import hashlib
import json
import subprocess
import sys
import time
from pathlib import Path

BOARD = 9
GTP_COLS = "ABCDEFGHJ"  # 'I' skipped by convention

# Must match scripts/extract_epub_openings.py exactly — the position index
# keys were canonicalised with these functions.
SYMMETRIES = {
    "identity": lambda c, r: (c, r),
    "rot90": lambda c, r: (BOARD - 1 - r, c),
    "rot180": lambda c, r: (BOARD - 1 - c, BOARD - 1 - r),
    "rot270": lambda c, r: (r, BOARD - 1 - c),
    "flip_h": lambda c, r: (BOARD - 1 - c, r),
    "flip_v": lambda c, r: (c, BOARD - 1 - r),
    "transpose": lambda c, r: (r, c),
    "anti_transpose": lambda c, r: (BOARD - 1 - r, BOARD - 1 - c),
}

KOMI = 6.5
RULES = "japanese"


def coord_to_idx(coord):
    col, row = ord(coord[0]) - 97, ord(coord[1]) - 97
    return row * BOARD + col


def transform_coord_idx(coord, tf_name):
    """Diagram coord ('ee') -> board index in canonical orientation."""
    col, row = ord(coord[0]) - 97, ord(coord[1]) - 97
    tc, tr = SYMMETRIES[tf_name](col, row)
    return tr * BOARD + tc


def idx_to_gtp(idx):
    row, col = divmod(idx, BOARD)
    return f"{GTP_COLS[col]}{BOARD - row}"


def gtp_to_idx(gtp):
    if gtp.lower() == "pass":
        return None
    col = GTP_COLS.index(gtp[0].upper())
    row = BOARD - int(gtp[1:])
    return row * BOARD + col


class Engine:
    def __init__(self, katago, model, config):
        self.proc = subprocess.Popen(
            [katago, "analysis", "-model", model, "-config", config],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, bufsize=1,
        )
        self.counter = 0

    def query(self, initial_stones, to_move, visits, force_gtp=None):
        """Analyse a static position. force_gtp restricts the root move."""
        self.counter += 1
        qid = f"q{self.counter}"
        req = {
            "id": qid,
            "initialStones": initial_stones,
            "moves": [],
            "initialPlayer": to_move,
            "rules": RULES,
            "komi": KOMI,
            "boardXSize": BOARD,
            "boardYSize": BOARD,
            "maxVisits": visits,
            "includeOwnership": False,
        }
        if force_gtp:
            avoid = [idx_to_gtp(i) for i in range(BOARD * BOARD)
                     if idx_to_gtp(i) != force_gtp]
            req["avoidMoves"] = [
                {"player": to_move, "untilDepth": 1, "moves": avoid + ["pass"]}
            ]
        self.proc.stdin.write(json.dumps(req) + "\n")
        self.proc.stdin.flush()
        while True:
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError("KataGo terminated")
            res = json.loads(line)
            if res.get("id") != qid:
                continue
            if "error" in res:
                raise RuntimeError(f"KataGo error: {res['error']}")
            if "warning" in res and "moveInfos" not in res:
                continue
            if res.get("isDuringSearch") is False or "moveInfos" in res:
                return res

    def close(self):
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()


def build_units(db):
    """(canon, toMove) -> {stones, book: {idx: meta}} for every position
    that has at least one book continuation."""
    branch_by_id = {b["branch_id"]: b for b in db["branches"]}
    units = {}
    skipped_occupied = 0
    for canon, entries in db["position_index"].items():
        for e in entries:
            br = branch_by_id[e["branch_id"]]
            moves, ply = br["moves"], e["ply"]
            if ply < len(moves):
                nxt = [{"color": moves[ply]["color"], "coord": moves[ply]["coord"],
                        "kind": "line"}]
            else:
                nxt = [{"color": c["by"], "coord": c["coord"],
                        "kind": c.get("kind") or "cont", "label": c.get("label")}
                       for c in (br.get("continuations") or []) if c.get("coord")]
            for mv in nxt:
                cidx = transform_coord_idx(mv["coord"], e["to_canonical"])
                # Self-check: a book continuation must land on an empty point
                # of the indexed position; anything else means our transform
                # understanding is wrong.
                if canon[cidx] != ".":
                    skipped_occupied += 1
                    continue
                player = mv["color"].upper()[0]  # 'B' / 'W'
                key = (canon, player)
                u = units.setdefault(key, {"book": {}})
                slot = u["book"].setdefault(cidx, {"kinds": set(), "branches": set()})
                slot["kinds"].add(mv["kind"])
                slot["branches"].add(e["branch_id"])
    if skipped_occupied:
        print(f"WARNING: {skipped_occupied} book moves landed on occupied points "
              f"(transform bug?) — investigate", file=sys.stderr)
    # Leaf positions (final diagrams with no continuations) still deserve a
    # position eval — the app shows "who is ahead" when an opening completes.
    # Side to move from stone parity (openings never lose stones early).
    covered = {canon for (canon, _p) in units}
    for canon in db["position_index"]:
        if canon in covered:
            continue
        nb = canon.count("b")
        nw = canon.count("w")
        player = "B" if nb == nw else "W"
        units[(canon, player)] = {"book": {}}
    return units


def unit_id(canon, player):
    return hashlib.sha1(f"{canon}|{player}".encode()).hexdigest()[:16]


def stones_of(canon):
    return [["B" if s == "b" else "W", idx_to_gtp(i)]
            for i, s in enumerate(canon) if s != "."]


def evaluate(args):
    db = json.loads(Path(args.db).read_text())
    units = build_units(db)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    todo = []
    for (canon, player), u in sorted(units.items()):
        if (out_dir / f"{unit_id(canon, player)}.json").exists():
            continue
        todo.append((canon, player, u))
    if args.limit:
        todo = todo[:args.limit]
    print(f"units total={len(units)} todo={len(todo)} visits={args.visits}")
    if not todo:
        return 0

    eng = Engine(args.katago, args.model, args.config)
    t0 = time.time()
    done = 0
    try:
        for canon, player, u in todo:
            stones = stones_of(canon)
            root = eng.query(stones, player, args.visits)
            infos = sorted(root.get("moveInfos", []),
                           key=lambda m: m.get("order", 99))
            evals = {}
            for m in infos:
                idx = gtp_to_idx(m["move"])
                if idx is None:
                    continue
                evals[idx] = {
                    "gtp": m["move"],
                    "winrate": round(m.get("winrate", 0.5), 4),
                    "scoreLead": round(m.get("scoreLead", 0.0), 2),
                    "visits": m.get("visits", 0),
                    "order": m.get("order", 99),
                }
            forced = 0
            for bidx in u["book"]:
                if bidx in evals:
                    continue
                res = eng.query(stones, player, max(200, args.visits // 3),
                                force_gtp=idx_to_gtp(bidx))
                fi = sorted(res.get("moveInfos", []),
                            key=lambda m: m.get("order", 99))
                if not fi:
                    continue
                m = fi[0]
                evals[bidx] = {
                    "gtp": m["move"],
                    "winrate": round(m.get("winrate", 0.5), 4),
                    "scoreLead": round(m.get("scoreLead", 0.0), 2),
                    "visits": m.get("visits", 0),
                    "order": 99,  # not among root's searched top moves
                    "forced": True,
                }
                forced += 1
            # Verify: every book move now has an eval.
            missing = [i for i in u["book"] if i not in evals]
            record = {
                "canon": canon,
                "toMove": player,
                "visits": args.visits,
                "komi": KOMI,
                "rules": RULES,
                "rootWinrate": round(root.get("rootInfo", {}).get("winrate", 0.5), 4),
                "rootScoreLead": round(root.get("rootInfo", {}).get("scoreLead", 0.0), 2),
                "moves": {str(i): v for i, v in evals.items()},
                "book": {str(i): {"kinds": sorted(u["book"][i]["kinds"]),
                                   "branches": sorted(u["book"][i]["branches"])}
                         for i in u["book"]},
                "missing": missing,
                "forcedQueries": forced,
            }
            (out_dir / f"{unit_id(canon, player)}.json").write_text(
                json.dumps(record))
            done += 1
            if done % 20 == 0 or done == len(todo):
                dt = time.time() - t0
                print(f"  {done}/{len(todo)}  {dt/done:.1f}s/unit  "
                      f"eta {int((len(todo)-done)*dt/done/60)}min", flush=True)
    finally:
        eng.close()
    print(f"done {done} units in {int(time.time()-t0)}s")
    return 0


def merge(args):
    db = json.loads(Path(args.db).read_text())
    units = build_units(db)
    out_dir = Path(args.out)
    positions = {}
    missing_units, missing_moves, forced_total = [], 0, 0
    mismatches = []
    for (canon, player), u in sorted(units.items()):
        p = out_dir / f"{unit_id(canon, player)}.json"
        if not p.exists():
            missing_units.append((canon, player))
            continue
        rec = json.loads(p.read_text())
        moves = {int(k): v for k, v in rec["moves"].items()}
        if rec.get("missing"):
            missing_moves += len(rec["missing"])
        forced_total += rec.get("forcedQueries", 0)
        # engine's best = lowest order among root-searched moves.
        # Sanity: a suggested move must land on an empty point of the canon
        # board; a mismatch means the indexed position itself is corrupt
        # (e.g. the komoku/18 extraction glitch) — drop such records.
        ranked = sorted((v for v in moves.values() if not v.get("forced")),
                        key=lambda m: m["order"])
        if any(canon[gtp_to_idx(m["gtp"])] != "." for m in ranked
               if gtp_to_idx(m["gtp"]) is not None):
            print(f"  dropped corrupt position (unit {unit_id(canon, player)}, "
                  f"branch {sorted(next(iter(u['book'].values()))['branches'])[0] if u['book'] else 'leaf'})")
            continue
        best = ranked[:5]
        book_out = {}
        book_best_wr = None
        for bidx, meta in u["book"].items():
            ev = moves.get(bidx)
            if not ev:
                continue
            rank = next((n + 1 for n, m in enumerate(ranked)
                         if m["gtp"] == ev["gtp"]), None)
            book_out[bidx] = {
                "winrate": ev["winrate"],
                "scoreLead": ev["scoreLead"],
                "rank": rank,
            }
            if book_best_wr is None or ev["winrate"] > book_best_wr:
                book_best_wr = ev["winrate"]
        if best and book_best_wr is not None:
            delta_wr = best[0]["winrate"] - book_best_wr
            if delta_wr > args.mismatch_winrate:
                sample_branch = sorted(
                    next(iter(u["book"].values()))["branches"])[0]
                mismatches.append({
                    "branch": sample_branch,
                    "toMove": player,
                    "kataBest": best[0]["gtp"],
                    "kataWinrate": best[0]["winrate"],
                    "bookBestWinrate": book_best_wr,
                    "deltaWinrate": round(delta_wr, 3),
                })
        positions.setdefault(canon, {})[player] = {
            "best": [{"at": gtp_to_idx(m["gtp"]),
                      "winrate": m["winrate"],
                      "scoreLead": m["scoreLead"]} for m in best],
            "book": book_out,
        }

    out = {
        "board_size": BOARD,
        "komi": KOMI,
        "rules": RULES,
        "winrate_perspective": "side_to_move",
        "position_count": len(positions),
        "positions": positions,
    }
    dest = Path("apps/mobile/src/data/opening_evals.json")
    dest.write_text(json.dumps(out, ensure_ascii=False))
    print(f"merged {len(positions)} positions -> {dest}")
    print(f"units missing checkpoints: {len(missing_units)}")
    print(f"book moves without eval: {missing_moves}")
    print(f"forced (off-search) book-move queries: {forced_total}")
    print(f"mismatches (book best worse than KataGo best by >"
          f"{args.mismatch_winrate:.0%} winrate): {len(mismatches)}")
    for m in sorted(mismatches, key=lambda x: -x["deltaWinrate"])[:30]:
        print(f"  {m['branch']:40s} {m['toMove']} kata {m['kataBest']}"
              f" wr {m['kataWinrate']:.2f} vs book {m['bookBestWinrate']:.2f}"
              f" (Δ{m['deltaWinrate']:.2f})")
    if missing_units:
        print("NOT all units evaluated — merge is partial; rerun eval to finish.")
    Path("data/openings/eval_mismatches.json").write_text(
        json.dumps(mismatches, ensure_ascii=False, indent=1))
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--katago")
    ap.add_argument("--model")
    ap.add_argument("--config")
    ap.add_argument("--visits", type=int, default=800)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--db", default="apps/mobile/src/data/branches.json")
    ap.add_argument("--out", default="data/openings/evals")
    ap.add_argument("--merge", action="store_true")
    ap.add_argument("--mismatch-winrate", type=float, default=0.04)
    args = ap.parse_args()
    if args.merge:
        return merge(args)
    if not (args.katago and args.model and args.config):
        ap.error("--katago/--model/--config required for evaluation")
    return evaluate(args)


if __name__ == "__main__":
    sys.exit(main())
