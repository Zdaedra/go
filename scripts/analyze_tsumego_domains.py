#!/usr/bin/env python3
"""Р1b (Vast-side): собрать сырьё для доменного классификатора с KataGo.

Для каждой задачи 19×19 с деревом — два запроса анализа:
  A. решатель ходит первым (как в задаче): ownership + длинный PV лучшего хода;
  B. tenuki-тест: первым ходит оппонент — ownership.
Разница владений A/B и длинный PV дают семантику домена (жизнь/смерть/ко/
гонка/соединение), которой не видно в обрезанных деревьях разметки.

Пишет JSONL-кэш: {id, pv, own_a, own_b, wr_a}. Ownership квантуем до 2
знаков, только внутри view+2 (остальное — нули, не тратим место).

Запуск на боксе (после Р2, тем же движком):
  python3 scripts/analyze_tsumego_domains.py \
      --katago /root/katago/squashfs-root/AppRun \
      --model /root/katago/network.bin.gz \
      --config /root/katago/analysis_fast.cfg \
      --visits 300 --out domains_cache.jsonl
Резюмируемый: уже посчитанные id пропускаются.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

SIZE = 19
SGF = "abcdefghijklmnopqrs"
GTP_COLS = "ABCDEFGHJKLMNOPQRST"


def coord_to_gtp(coord):
    c, r = ord(coord[0]) - 97, ord(coord[1]) - 97
    return f"{GTP_COLS[c]}{SIZE - r}"


class Engine:
    def __init__(self, katago, model, config, visits):
        self.visits = visits
        self.proc = subprocess.Popen(
            [katago, "analysis", "-model", model, "-config", config],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, text=True, bufsize=1,
        )
        self.counter = 0

    def query(self, initial_stones, to_move, allow_gtp):
        self.counter += 1
        qid = f"q{self.counter}"
        allowed = set(allow_gtp)
        avoid = [
            f"{GTP_COLS[c]}{SIZE - r}"
            for r in range(SIZE) for c in range(SIZE)
            if f"{GTP_COLS[c]}{SIZE - r}" not in allowed
        ]
        req = {
            "id": qid,
            "initialStones": initial_stones,
            "moves": [],
            "initialPlayer": to_move,
            "rules": "japanese",
            "komi": 6.5,
            "boardXSize": SIZE,
            "boardYSize": SIZE,
            "maxVisits": self.visits,
            "includeOwnership": True,
            "avoidMoves": [
                {"player": p, "untilDepth": 50, "moves": avoid}
                for p in ("B", "W")
            ],
        }
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
            if res.get("isDuringSearch") is False or "moveInfos" in res:
                return res

    def close(self):
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=10)
        except Exception:
            self.proc.kill()


def problem_stones(problem):
    stones = []
    for i, ch in enumerate(problem["board"]):
        if ch == ".":
            continue
        coord = chr(97 + i % SIZE) + chr(97 + i // SIZE)
        stones.append(["B" if ch == "b" else "W", coord_to_gtp(coord)])
    return stones


def problem_region(problem, margin=1):
    v = problem.get("view") or {"c0": 0, "r0": 0, "c1": SIZE - 1, "r1": SIZE - 1}
    out = []
    for r in range(max(0, v["r0"] - margin), min(SIZE, v["r1"] + 1 + margin)):
        for c in range(max(0, v["c0"] - margin), min(SIZE, v["c1"] + 1 + margin)):
            if problem["board"][r * SIZE + c] == ".":
                out.append(f"{GTP_COLS[c]}{SIZE - r}")
    return out


def own_crop(problem, ownership, margin=2):
    """Ownership только внутри view+margin, квантованный: [[idx, val], ...]."""
    v = problem.get("view") or {"c0": 0, "r0": 0, "c1": SIZE - 1, "r1": SIZE - 1}
    out = []
    for r in range(max(0, v["r0"] - margin), min(SIZE, v["r1"] + 1 + margin)):
        for c in range(max(0, v["c0"] - margin), min(SIZE, v["c1"] + 1 + margin)):
            i = r * SIZE + c
            val = ownership[i] if i < len(ownership) else 0.0
            out.append([i, round(val, 2)])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--katago", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--config", required=True)
    ap.add_argument("--visits", type=int, default=300)
    ap.add_argument("--data", default="data/tsumego/problems.json")
    ap.add_argument("--out", default="domains_cache.jsonl")
    ap.add_argument("--limit", type=int, default=99999)
    args = ap.parse_args()

    db = json.loads(Path(args.data).read_text(encoding="utf-8"))
    # Все 19×19 с деревом: классика (цель) + gokyo (валидация правил).
    todo = [p for p in db["problems"] if p.get("size") == SIZE and p.get("tree")]

    done = set()
    out_path = Path(args.out)
    if out_path.exists():
        for line in out_path.read_text(encoding="utf-8").splitlines():
            try:
                done.add(json.loads(line)["id"])
            except Exception:
                pass
    todo = [p for p in todo if p["id"] not in done][: args.limit]
    print(f"analyzing {len(todo)} problems (skip {len(done)} cached), "
          f"visits={args.visits}", flush=True)

    engine = Engine(args.katago, args.model, args.config, args.visits)
    n = 0
    try:
        with out_path.open("a", encoding="utf-8") as fh:
            for p in todo:
                stones = problem_stones(p)
                region = problem_region(p)
                solver = "B" if p["to_move"] == "b" else "W"
                opp = "W" if solver == "B" else "B"
                try:
                    res_a = engine.query(stones, solver, region)
                    res_b = engine.query(stones, opp, region)
                except RuntimeError as e:
                    print(f"engine error at {p['id']}: {e}", flush=True)
                    break
                infos = sorted(res_a.get("moveInfos", []),
                               key=lambda m: m.get("order", 99))
                best = infos[0] if infos else {}
                rec = {
                    "id": p["id"],
                    "pv": best.get("pv", []),           # длинная линия, GTP
                    "wr_a": round(best.get("winrate", 0.5), 3),
                    "own_a": own_crop(p, res_a.get("ownership", [])),
                    "own_b": own_crop(p, res_b.get("ownership", [])),
                }
                fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
                fh.flush()
                n += 1
                if n % 25 == 0:
                    print(f"  {n}/{len(todo)}", flush=True)
    finally:
        engine.close()
    print(f"cached {n} problems -> {out_path}", flush=True)


if __name__ == "__main__":
    sys.exit(main())
