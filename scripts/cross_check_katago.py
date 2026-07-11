#!/usr/bin/env python3
"""Second-engine cross-check: does KataGo agree with the generator's key?

For each generated problem, ask KataGo (analysis engine) for its best move,
restricted to the local region (allowMoves — otherwise KataGo tenukis to a big
point elsewhere and never "solves" the local shape). Compare to the solver's
certified key. High agreement = the CPU solver's certification is independently
confirmed.

Runs on the box that has KataGo (Vast):
    python3 cross_check_katago.py sample.json \
        --katago /root/katago/katago --model /root/katago/network.bin.gz \
        --config /root/katago/analysis_fast.cfg --visits 200
"""

import argparse
import json
import subprocess
import sys

GTP_COLS = "ABCDEFGHJKLMNOPQRST"  # no 'I'


def idx_rc(idx, n):
    return idx % n, idx // n


def rc_to_gtp(c, r, n):
    return f"{GTP_COLS[c]}{n - r}"


def gtp_to_rc(gtp, n):
    c = GTP_COLS.index(gtp[0].upper())
    r = n - int(gtp[1:])
    return c, r


def coord_to_rc(coord):
    return ord(coord[0]) - 97, ord(coord[1]) - 97


def rc_to_coord(c, r):
    return chr(97 + c) + chr(97 + r)


def neighbors_rc(c, r, n):
    for dc, dr in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nc, nr = c + dc, r + dr
        if 0 <= nc < n and 0 <= nr < n:
            yield nc, nr


def region_gtp(board, n, rings=1):
    """The local fight only: empty points orthogonally adjacent to a stone,
    grown `rings` times. KataGo maximizes whole-board SCORE, so a wide region
    lets it grab center territory instead of making the small local capture —
    the region must be tight enough that the tsumego move is the only real
    option. One ring = the groups' liberties, which is where the answer lives."""
    contact = {i for i, ch in enumerate(board) if ch == "."
               and any(board[nb] != "." for nb in _neighbors_idx(i, n))}
    region = set(contact)
    for _ in range(rings - 1):
        for i in list(region):
            for nb in _neighbors_idx(i, n):
                if board[nb] == ".":
                    region.add(nb)
    return sorted(rc_to_gtp(i % n, i // n, n) for i in region)


def _neighbors_idx(i, n):
    c, r = i % n, i // n
    out = []
    for dc, dr in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        nc, nr = c + dc, r + dr
        if 0 <= nc < n and 0 <= nr < n:
            out.append(nr * n + nc)
    return out


def build_request(qid, board, n, to_move, visits, region):
    stones = []
    for i, ch in enumerate(board):
        if ch == ".":
            continue
        c, r = idx_rc(i, n)
        stones.append(["B" if ch == "b" else "W", rc_to_gtp(c, r, n)])
    player = "B" if to_move == "b" else "W"
    # Restrict the WHOLE search to the local region, exactly like the marking
    # pipeline: allowMoves only binds depth 1, so KataGo tenukis to a big
    # opening point; avoidMoves (everything OUTSIDE the region) at untilDepth 50
    # for both players keeps the engine solving the local shape.
    allowed = set(region)
    avoid = sorted(rc_to_gtp(c, r, n)
                   for c in range(n) for r in range(n)
                   if rc_to_gtp(c, r, n) not in allowed)
    return {
        "id": qid,
        "initialStones": stones,
        "moves": [],
        "initialPlayer": player,
        "rules": "japanese",
        "komi": 7.0,
        "boardXSize": n, "boardYSize": n,
        "maxVisits": visits,
        "avoidMoves": [
            {"player": "B", "untilDepth": 50, "moves": avoid},
            {"player": "W", "untilDepth": 50, "moves": avoid},
        ],
    }


def run_batch(katago, model, config, requests):
    """Feed all queries at once, close stdin, collect responses by id. The
    interactive one-query-at-a-time mode dies after a single query in this
    AppImage-extracted environment; batch (stream then EOF) is what works."""
    proc = subprocess.Popen(
        [katago, "analysis", "-model", model, "-config", config],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL, text=True,
    )
    payload = "\n".join(json.dumps(r) for r in requests) + "\n"
    import os
    if os.environ.get("CC_DEBUG"):
        with open("req_dump.json", "w") as f:
            f.write(json.dumps(requests[0], indent=1))
    out, _ = proc.communicate(payload)
    if os.environ.get("CC_DEBUG"):
        with open("raw_out.txt", "w") as f:
            f.write(out)
    best = {}
    for line in out.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        resp = json.loads(line)
        infos = sorted(resp.get("moveInfos", []), key=lambda m: -m.get("visits", 0))
        if infos:
            best[resp["id"]] = infos[0]["move"]
    return best


def key_of(problem):
    for node in problem.get("tree", []):
        if node.get("tag") == "correct" or node.get("children"):
            return node["at"]
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sample")
    ap.add_argument("--katago", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--config", required=True)
    ap.add_argument("--visits", type=int, default=200)
    args = ap.parse_args()

    data = json.loads(open(args.sample).read())
    problems = data["problems"] if isinstance(data, dict) else data

    requests, meta = [], {}
    for i, p in enumerate(problems):
        n = p.get("size", 9)
        key = key_of(p)
        if key is None:
            continue
        region = region_gtp(p["board"], n)
        kc = coord_to_rc(key)
        key_gtp = rc_to_gtp(kc[0], kc[1], n)
        if key_gtp not in region:
            region.append(key_gtp)
        qid = f"q{i}"
        requests.append(build_request(qid, p["board"], n, p["to_move"],
                                      args.visits, region))
        meta[qid] = (p["id"], key, key_gtp)

    best = run_batch(args.katago, args.model, args.config, requests)

    agree = disagree = skipped = 0
    mism = []
    for qid, (pid, key, key_gtp) in meta.items():
        mv = best.get(qid)
        if mv is None:
            skipped += 1
            continue
        if mv.upper() == key_gtp.upper():
            agree += 1
        else:
            disagree += 1
            mism.append(f"{pid}: solver {key}({key_gtp}) vs katago {mv}")

    total = agree + disagree
    pct = 100 * agree / total if total else 0
    print(f"cross-check: {agree}/{total} agree ({pct:.1f}%), skipped {skipped}")
    for m in mism[:25]:
        print("  MISMATCH", m)


if __name__ == "__main__":
    main()
