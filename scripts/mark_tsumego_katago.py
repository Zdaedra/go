#!/usr/bin/env python3
"""Mark tsumego solutions automatically with KataGo.

Takes unmarked problems (empty solution tree) from the tsumego database,
asks a KataGo analysis engine for the best line and clearly-losing
alternatives, and writes solution trees in the app's format:

  - main line: engine best move for each side alternately, until the
    evaluation is stable/decided or a ply limit is reached; the last
    solver move is tagged "correct";
  - root alternatives that lose at least --wrong-margin points get tagged
    "wrong" with a short refutation line;
  - near-equal root alternatives become additional correct branches.

Every generated tree is replayed through the capture engine before it is
accepted. Results are checkpointed per problem (data/tsumego/marked/) so
the batch can be stopped and resumed anywhere — locally, on a Hetzner CPU
box, or on a rented GPU (Vast.ai / RunPod): only --katago/--model change.

Usage:
    python3 scripts/mark_tsumego_katago.py \
        --katago /path/to/katago --model /path/to/model.bin.gz \
        --config /path/to/analysis.cfg \
        [--visits 400] [--limit 20] [--prefix gokyo-living] [--merge]

    --merge  merge all checkpointed trees into the app database
             (apps/mobile/src/data/tsumego.json + data/tsumego/problems.json)
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from import_tsumego_txt import SIZE, play  # noqa: E402  (19x19 engine)

GTP_COLS = "ABCDEFGHJKLMNOPQRST"

MAIN_LINE_PLIES = 8
WRONG_BRANCHES = 3
REFUTATION_PLIES = 2
DECIDED_WINRATE = 0.92  # from the mover's perspective: position is settled
ALT_CORRECT_MARGIN = 0.6  # scoreLead within this of best => also correct


def coord_to_gtp(coord):
    c, r = ord(coord[0]) - 97, ord(coord[1]) - 97
    return f"{GTP_COLS[c]}{SIZE - r}"


def gtp_to_coord(gtp):
    if gtp.lower() == "pass":
        return None
    c = GTP_COLS.index(gtp[0].upper())
    r = SIZE - int(gtp[1:])
    return chr(97 + c) + chr(97 + r)


class Engine:
    def __init__(self, katago, model, config, visits):
        self.visits = visits
        self.proc = subprocess.Popen(
            [katago, "analysis", "-model", model, "-config", config],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, bufsize=1,
        )
        self.counter = 0

    def query(self, initial_stones, moves, to_move, allow_gtp=None):
        """initial_stones: [('B'|'W', gtp)], moves: [('B'|'W', gtp)].

        `allow_gtp` restricts BOTH players to the problem region — without
        it KataGo treats the position as a whole-board opening and runs
        off to claim the empty part of the board instead of solving the
        local group.
        """
        self.counter += 1
        qid = f"q{self.counter}"
        req = {
            "id": qid,
            "initialStones": initial_stones,
            "moves": moves,
            "initialPlayer": to_move,
            "rules": "japanese",
            "komi": 6.5,
            "boardXSize": SIZE,
            "boardYSize": SIZE,
            "maxVisits": self.visits,
            "includeOwnership": False,
        }
        if allow_gtp:
            # The analysis API's allowMoves only supports depth 1, so we
            # forbid everything OUTSIDE the problem region instead —
            # avoidMoves supports arbitrary depth for both players.
            allowed = set(allow_gtp)
            avoid = [
                f"{GTP_COLS[c]}{SIZE - r}"
                for r in range(SIZE) for c in range(SIZE)
                if f"{GTP_COLS[c]}{SIZE - r}" not in allowed
            ]
            req["avoidMoves"] = [
                {"player": p, "untilDepth": 50, "moves": avoid}
                for p in ("B", "W")
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


def best_moves(result, limit=6):
    infos = sorted(result.get("moveInfos", []), key=lambda m: m.get("order", 99))
    return [
        {
            "gtp": m["move"],
            "winrate": m.get("winrate", 0.5),
            "score": m.get("scoreLead", 0.0),
            "visits": m.get("visits", 0),
        }
        for m in infos[:limit]
    ]


def problem_stones(problem):
    stones = []
    for i, ch in enumerate(problem["board"]):
        if ch == ".":
            continue
        coord = chr(97 + i % SIZE) + chr(97 + i // SIZE)
        stones.append(["B" if ch == "b" else "W", coord_to_gtp(coord)])
    return stones


def problem_region(problem, margin=1):
    """GTP list of the problem's view rect (plus margin): the move space."""
    v = problem.get("view") or {"c0": 0, "r0": 0, "c1": SIZE - 1, "r1": SIZE - 1}
    out = []
    for r in range(max(0, v["r0"] - margin), min(SIZE, v["r1"] + 1 + margin)):
        for c in range(max(0, v["c0"] - margin), min(SIZE, v["c1"] + 1 + margin)):
            if problem["board"][r * SIZE + c] == ".":
                out.append(f"{GTP_COLS[c]}{SIZE - r}")
    return out


def build_main_line(engine, stones, to_move, region, first_move=None):
    """Follow engine-best moves; return list of (color, gtp) plies."""
    moves, mover = [], to_move
    for ply in range(MAIN_LINE_PLIES):
        if ply == 0 and first_move is not None:
            choice = first_move
        else:
            res = engine.query(stones, moves, mover, allow_gtp=region)
            cands = best_moves(res, 2)
            if not cands or cands[0]["gtp"].lower() == "pass":
                break
            choice = cands[0]["gtp"]
            # Stop extending once the game there is clearly settled.
            if ply >= 2 and cands[0]["winrate"] >= DECIDED_WINRATE:
                moves.append([mover, choice])
                break
        moves.append([mover, choice])
        mover = "W" if mover == "B" else "B"
    return moves


def moves_to_tree(moves, solver, tag_last="correct"):
    node = None
    for color, gtp in reversed(moves):
        coord = gtp_to_coord(gtp)
        if coord is None:
            continue
        entry = {"at": coord, "by": color.lower()}
        if node is None:
            entry["tag"] = tag_last
        else:
            entry["children"] = [node]
        node = entry
    return node


def trim_to_solver_end(moves, solver):
    """Cut trailing opponent moves so the line ends on a solver move."""
    while moves and moves[-1][0] != solver:
        moves.pop()
    return moves


def verify_tree(problem, root):
    board = list(problem["board"])
    node = root
    while node:
        c, r = ord(node["at"][0]) - 97, ord(node["at"][1]) - 97
        board = play(board, r * SIZE + c, node["by"])
        if board is None:
            return False
        node = (node.get("children") or [None])[0]
    return True


def mark_problem(engine, problem):
    stones = problem_stones(problem)
    region = problem_region(problem)
    solver = "B" if problem["to_move"] == "b" else "W"
    root_res = engine.query(stones, [], solver, allow_gtp=region)
    # Wider candidate window (engine.root_cands) surfaces more losing-but-
    # plausible root moves — the decoy pool for problems that got none at
    # the default width.
    cands = best_moves(root_res, getattr(engine, "root_cands", 1 + WRONG_BRANCHES + 1))
    if not cands or cands[0]["gtp"].lower() == "pass":
        return None
    best = cands[0]

    tree = []
    # Best line (and near-equal alternatives) => correct branches.
    for cand in cands:
        if cand["gtp"].lower() == "pass":
            continue
        if cand is not best and best["score"] - cand["score"] > ALT_CORRECT_MARGIN:
            continue
        line = build_main_line(engine, stones, solver, region, first_move=cand["gtp"])
        line = trim_to_solver_end(line, solver)
        node = moves_to_tree(line, solver)
        if node:
            tree.append(node)

    # Clearly losing root alternatives => wrong, with a short refutation.
    wrongs = 0
    for cand in cands[1:]:
        if wrongs >= WRONG_BRANCHES:
            break
        if cand["gtp"].lower() == "pass":
            continue
        drop = best["score"] - cand["score"]
        if drop < engine.wrong_margin:
            continue
        refute = [[solver, cand["gtp"]]]
        mover = "W" if solver == "B" else "B"
        for _ in range(REFUTATION_PLIES):
            res = engine.query(stones, refute, mover, allow_gtp=region)
            rc = best_moves(res, 1)
            if not rc or rc[0]["gtp"].lower() == "pass":
                break
            refute.append([mover, rc[0]["gtp"]])
            mover = "W" if mover == "B" else "B"
        node = moves_to_tree(refute, solver, tag_last=None)
        # First move of the branch carries the wrong tag.
        if node:
            node["tag"] = "wrong"
            tree.append(node)
            wrongs += 1

    if not tree:
        return None
    for root in tree:
        if not verify_tree(problem, root):
            return None
    return tree


def visits_of(marked_by):
    """Visits a tree was marked with: new dict format or legacy
    'katago-visits200' string. 0 when unknown/absent."""
    if isinstance(marked_by, dict):
        return int(marked_by.get("visits") or 0)
    if isinstance(marked_by, str):
        digits = "".join(ch for ch in marked_by if ch.isdigit())
        return int(digits) if digits else 0
    return 0


def merge(db_paths, marked_dir):
    # View windows were originally computed from the setup stones alone; a
    # merged tree can run past them (escapes toward the centre), leaving its
    # moves invisible/untappable in the app. Recompute views after merging.
    from fix_tsumego_views import recompute_view

    trees = {}
    for f in sorted(Path(marked_dir).glob("*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        if data.get("tree"):
            trees[data["id"]] = data
    for path in db_paths:
        db = json.loads(Path(path).read_text(encoding="utf-8"))
        updated = 0
        for p in db["problems"]:
            hit = trees.get(p["id"])
            # Adopt a checkpoint when the problem has no tree yet, or when
            # the checkpoint comes from a deeper run (decoy re-mining).
            if hit and (not p.get("tree")
                        or visits_of(hit.get("marked_by")) > visits_of(p.get("marked_by"))):
                p["tree"] = hit["tree"]
                p["marked_by"] = hit.get("marked_by", "katago")
                updated += 1
            if p.get("tree"):
                recompute_view(p)
        Path(path).write_text(json.dumps(db, ensure_ascii=False, indent=1),
                              encoding="utf-8")
        print(f"{path}: merged {updated} trees")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--katago")
    ap.add_argument("--model")
    ap.add_argument("--config")
    ap.add_argument("--visits", type=int, default=400)
    ap.add_argument("--wrong-margin", type=float, default=4.0)
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--prefix", default="")
    ap.add_argument("--merge", action="store_true")
    ap.add_argument("--data", default="data/tsumego/problems.json")
    ap.add_argument("--root-cands", type=int, default=1 + WRONG_BRANCHES + 1,
                    help="root candidates to consider (wider => more decoys)")
    ap.add_argument("--redo-no-decoys", action="store_true",
                    help="re-mark 19x19 problems whose tree has no wrong "
                         "branches (overwrites their checkpoints); resumes "
                         "past checkpoints already made at >= --visits")
    args = ap.parse_args()

    marked_dir = Path("data/tsumego/marked")
    marked_dir.mkdir(parents=True, exist_ok=True)
    app_db = "apps/mobile/src/data/tsumego.json"

    if args.merge:
        merge([args.data, app_db], marked_dir)
        return 0

    if not (args.katago and args.model and args.config):
        ap.error("--katago, --model and --config are required (or use --merge)")

    db = json.loads(Path(args.data).read_text(encoding="utf-8"))
    if args.redo_no_decoys:
        # Deeper re-mining pass: 19x19 problems whose tree carries zero
        # wrong branches (H3 has no decoys there). Hand-made 9x9 seeds are
        # excluded — the 19x19 engine would corrupt them. Resume: skip
        # problems whose checkpoint was already made at >= this visit depth.
        def redone(p):
            f = marked_dir / f"{p['id']}.json"
            if not f.exists():
                return False
            mb = json.loads(f.read_text(encoding="utf-8")).get("marked_by")
            return visits_of(mb) >= args.visits
        todo = [p for p in db["problems"]
                if p.get("size") == SIZE and p["id"].startswith(args.prefix)
                and p.get("tree")
                and not any(n.get("tag") == "wrong" for n in p["tree"])
                and not redone(p)]
    else:
        todo = [p for p in db["problems"]
                if not p.get("tree") and p["id"].startswith(args.prefix)
                and not (marked_dir / f"{p['id']}.json").exists()]
    todo = todo[: args.limit]
    print(f"marking {len(todo)} problems, visits={args.visits}, "
          f"wrong_margin={args.wrong_margin}, root_cands={args.root_cands}")

    engine = Engine(args.katago, args.model, args.config, args.visits)
    engine.wrong_margin = args.wrong_margin
    engine.root_cands = args.root_cands
    done = failed = 0
    try:
        for p in todo:
            try:
                tree = mark_problem(engine, p)
            except RuntimeError as e:
                print(f"engine error at {p['id']}: {e}")
                break
            out = {"id": p["id"], "tree": tree or [],
                   "marked_by": {
                       "engine": "katago",
                       "model": Path(args.model).name,
                       "visits": args.visits,
                       "wrongMargin": args.wrong_margin,
                       "rootCands": args.root_cands,
                       "date": __import__("datetime").date.today().isoformat(),
                   }}
            (marked_dir / f"{p['id']}.json").write_text(
                json.dumps(out, ensure_ascii=False), encoding="utf-8")
            if tree:
                done += 1
                print(f"  ok   {p['id']} ({len(tree)} branches)")
            else:
                failed += 1
                print(f"  skip {p['id']} (no confident tree)")
    finally:
        engine.close()
    print(f"marked={done} skipped={failed}; run with --merge to apply")
    return 0


if __name__ == "__main__":
    sys.exit(main())
