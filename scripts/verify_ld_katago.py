#!/usr/bin/env python3
"""Solve enclosed L&D candidates with KataGo (crop oracle) -> ld problems.

For each candidate (from gen_ld.py) query KataGo cropped onto the shape's own
board, BOTH sides to move:
  - black (attacker) first -> best move + side-to-move winrate;
  - white (defender) first -> best move + side-to-move winrate.

A genuine vital-point problem: both sides, moving first, win decisively AND
their best move is the SAME point (the vital point). Then emit one ld-kill
(black to move) and one ld-live (white to move), both keyed on the vital point,
with the other eye-space points as refuted decoys.

Runs on the KataGo box (Vast). Writes data/tsumego/generated/ld.json.
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import cross_check_katago as cc  # noqa: E402  (crop request helpers)


def crop_gtp_to_coord(mv, crop):
    if mv is None or mv.lower() == "pass":
        return None
    c0, r0, w, h = crop
    col = cc.GTP_COLS.index(mv[0].upper())
    row = h - int(mv[1:])
    return chr(97 + (col + c0)) + chr(97 + (row + r0))


def run_batch_rich(katago, model, config, requests):
    """{id: {move, winrate}} — winrate is side-to-move (config SIDETOMOVE)."""
    import subprocess
    proc = subprocess.Popen(
        [katago, "analysis", "-model", model, "-config", config],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL, text=True,
    )
    payload = "\n".join(json.dumps(r) for r in requests) + "\n"
    out, _ = proc.communicate(payload)
    res = {}
    for line in out.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        resp = json.loads(line)
        infos = sorted(resp.get("moveInfos", []),
                       key=lambda m: -m.get("visits", 0))
        if not infos:
            continue
        res[resp["id"]] = {
            "move": infos[0]["move"],
            "winrate": infos[0].get("winrate", 0.0),
            "ownership": resp.get("ownership"),
        }
    return res


def avg_white_own(rec, white_idxs):
    """Average KataGo ownership over the white group's cells. KataGo ownership
    is +Black / -White, so a strongly POSITIVE value = the group is dead."""
    own = rec.get("ownership")
    if not own or not white_idxs:
        return None
    return sum(own[i] for i in white_idxs) / len(white_idxs)


def emit(verified, path):
    problems = []
    cnt = {}
    for cand, vital, wk, wl in verified:
        eye = cand["eye"]
        decoys = [e for e in eye if e != vital]
        for domain, mover in (("ld-kill", "b"), ("ld-live", "w")):
            sec = "corner"  # section is cosmetic; catalog groups by category
            cnt[domain] = cnt.get(domain, 0) + 1
            tree = [{"at": vital, "by": mover, "tag": "correct"}]
            for d in decoys:
                tree.append({"at": d, "by": mover, "tag": "wrong"})
            problems.append({
                "id": f"gen-{domain}-{cand['shape']}-{cnt[domain]:03d}",
                "category": "life-death", "section": sec,
                "title": "Жизнь и смерть",
                "to_move": mover, "size": cand["size"], "board": cand["board"],
                "domain": domain, "difficulty": cand["difficulty"],
                "tree": tree, "scaleVersion": "v2-2026-07-11",
                "marked_by": {"engine": "gen-enclosed+katago-crop",
                              "shape": cand["shape"],
                              "winKill": round(wk, 3), "winLive": round(wl, 3)},
            })
    out = {
        "board_size": cc_N(),
        "source": "procedurally enclosed L&D, KataGo-verified vital point",
        "categories": [{"id": "life-death", "title": "Жизнь и смерть",
                        "sections": [{"id": "corner", "title": "Угол"},
                                     {"id": "side", "title": "Сторона"}]}],
        "problems": problems,
    }
    Path(path).write_text(json.dumps(out, ensure_ascii=False, indent=1),
                          encoding="utf-8")
    return problems


def cc_N():
    return 9


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("candidates")
    ap.add_argument("--katago", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--config", required=True)
    ap.add_argument("--visits", type=int, default=400)
    ap.add_argument("--margin", type=int, default=2)
    ap.add_argument("--per-shape", type=int, default=25)
    ap.add_argument("--dead", type=float, default=0.5,
                    help="min |ownership| to call white dead(+)/alive(-)")
    ap.add_argument("--out", default="data/tsumego/generated/ld.json")
    args = ap.parse_args()

    data = json.loads(open(args.candidates).read())
    cands = data["candidates"]
    # even subsample per shape
    byshape = {}
    for c in cands:
        byshape.setdefault(c["shape"], []).append(c)
    picked = []
    for shape, group in byshape.items():
        if len(group) <= args.per_shape:
            picked.extend(group)
        else:
            stride = len(group) / args.per_shape
            picked.extend(group[int(k * stride)] for k in range(args.per_shape))
    print(f"verifying {len(picked)} candidates ({args.per_shape}/shape)")

    requests, meta = [], {}
    for i, c in enumerate(picked):
        for side in ("b", "w"):
            req, crop = cc.build_request_crop(f"{i}-{side}", c["board"],
                                              c["size"], side, args.visits,
                                              args.margin)
            requests.append(req)
            meta[f"{i}-{side}"] = crop

    res = run_batch_rich(args.katago, args.model, args.config, requests)

    # Crop + best-move (the approach that recovered seed kill vital points): on
    # the shape's own small board, both sides' best move is the vital point —
    # black to kill, white to live. Verified iff BOTH best moves equal the
    # template's vital point. A thick wall (gen_ld) keeps its liberties under
    # the crop so it isn't removed.
    verified = []
    stats = {"no_resp": 0, "kill_miss": 0, "live_miss": 0, "ok": 0}
    for i, c in enumerate(picked):
        rb, rw = res.get(f"{i}-b"), res.get(f"{i}-w")
        if not rb or not rw:
            stats["no_resp"] += 1
            continue
        kill = crop_gtp_to_coord(rb["move"], meta[f"{i}-b"])
        live = crop_gtp_to_coord(rw["move"], meta[f"{i}-w"])
        if i < 15:
            print(f"  dbg {c['shape']:9s} vital={c['vital']} "
                  f"Bmv->{kill} Wmv->{live}")
        if kill != c["vital"]:
            stats["kill_miss"] += 1
            continue
        if live != c["vital"]:
            stats["live_miss"] += 1
            continue
        stats["ok"] += 1
        verified.append((c, c["vital"], rb["winrate"], rw["winrate"]))

    print("filter:", stats)
    problems = emit(verified, args.out)
    print(f"emitted {len(problems)} ld problems "
          f"({stats['ok']} shapes x2) -> {args.out}")
    from collections import Counter
    print("by domain:", dict(Counter(p["domain"] for p in problems)))


if __name__ == "__main__":
    main()
