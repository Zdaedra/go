#!/usr/bin/env python3
"""Import beginner puzzle collections from the OGS public API into app format.

Fills the low-tier connect/capture/ld gap that free PD sources don't cover and
procedural generation faked. OGS puzzles are user-contributed (variable
quality), so every puzzle is VALIDATED: 9x9 only, legal initial position,
correct line replays legally, has a solved leaf. Domain is assigned per
curated collection; difficulty from OGS rank. Provenance recorded per problem
(source/collection/owner) so the pre-publish commercial-license pass is exact.

License posture (2026-07-12): app is unpublished, personal-use integration.
OGS puzzles carry no license metadata; owners retain rights. Clear before any
public release. 101Weiqi-sourced collections are scraped — excluded.

Usage: python3 scripts/import_ogs.py        -> data/tsumego/generated/ogs.json
       then python3 scripts/merge_generated.py ogs
"""

import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/tsumego/generated/ogs.json"
CACHE = ROOT / "data/tsumego/ogs_cache"       # raw puzzle JSON, so re-runs don't re-fetch
ALLOWED_SIZES = {9, 13, 19}                   # app renders any size; classical are 19x19

# Curated non-101Weiqi collections: (id, domain, label). Kept small and
# single-theme so domain assignment is trustworthy.
COLLECTIONS = [
    (9318, "capture", "Basic Captures"),
    (4162, "capture", "Basics of Capture"),
    (118,  "capture", "Beginner Captures"),
    (7198, "capture", "Capture Basics"),
    (9370, "capture", "Black To Capture Rev 1"),
    (9371, "capture", "Black To Capture Rev 2"),
    (6429, "connect", "Connect and die for Beginner"),
    (2324, "connect", "Connect/Cut"),
    (918,  "connect", "Connecting exercise 1"),
    (8138, "connect", "Connections tesuji from Yeonwoo"),
    (10961, "connect", "Connecting Stones"),
    (7850, "ld-live", "Absolute Basics I"),
    # Досорсинг make-life новичкового низа (user-original, НЕ сканы книг —
    # Cho Chikun/Bozulich/Honinbo и пр. в чёрном списке по копирайту).
    (4253, "ld-live", "Basic Life puzzles"),
    (4765, "ld-live", "9x9 life and death"),
    (2697, "ld-live", "Hyacinth L&D"),
    (1924, "ld-live", "Beginner L&D"),
]

HEADERS = {"User-Agent": "Mozilla/5.0", "Referer": "https://online-go.com/"}


def get(url, cache_key=None):
    if cache_key:
        f = CACHE / f"{cache_key}.json"
        if f.exists():
            return json.loads(f.read_text(encoding="utf-8"))
    last = None
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=30) as r:
                data = json.loads(r.read().decode())
            if cache_key:
                CACHE.mkdir(parents=True, exist_ok=True)
                f.write_text(json.dumps(data), encoding="utf-8")
            return data
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429:            # rate limited — exponential backoff
                time.sleep(min(60, 3 * 2 ** attempt))
                continue
            raise
    raise last


def coord(x, y):
    return chr(97 + x) + chr(97 + y)


def parse_state(s):
    return [(ord(s[i]) - 97, ord(s[i + 1]) - 97) for i in range(0, len(s), 2)]


def neighbors(i, sz):
    r, c = divmod(i, sz)
    out = []
    if r > 0: out.append(i - sz)
    if r < sz - 1: out.append(i + sz)
    if c > 0: out.append(i - 1)
    if c < sz - 1: out.append(i + 1)
    return out


def group_libs(board, i, sz):
    col = board[i]; st = [i]; g = {i}; libs = set()
    while st:
        x = st.pop()
        for y in neighbors(x, sz):
            if board[y] == col and y not in g:
                g.add(y); st.append(y)
            elif board[y] == ".":
                libs.add(y)
    return g, libs


def play(board, i, color, sz):
    """Place + remove captured enemy groups. None if illegal (occupied/suicide)."""
    if board[i] != ".":
        return None
    b = list(board); b[i] = color
    opp = "w" if color == "b" else "b"
    for y in neighbors(i, sz):
        if b[y] == opp:
            g, l = group_libs(b, y, sz)
            if not l:
                for z in g: b[z] = "."
    g, l = group_libs(b, i, sz)
    if not l:
        return None  # suicide
    return "".join(b)


def build_board(state, sz):
    b = ["."] * (sz * sz)
    for (x, y) in parse_state(state.get("white", "")):
        if 0 <= x < sz and 0 <= y < sz: b[y * sz + x] = "w"
    for (x, y) in parse_state(state.get("black", "")):
        if 0 <= x < sz and 0 <= y < sz: b[y * sz + x] = "b"
    return "".join(b)


def legal_position(board, sz):
    seen = set()
    for i, ch in enumerate(board):
        if ch != "." and i not in seen:
            g, l = group_libs(board, i, sz); seen |= g
            if not l:
                return False  # a group already has 0 liberties -> illegal
    return True


def has_correct_desc(br):
    """OGS flags correct_answer only on the FINAL solving move. A player move
    is on the solution line iff a correct_answer sits somewhere below it."""
    if br.get("correct_answer"):
        return True
    return any(has_correct_desc(c) for c in br.get("branches", []))


def conv_tree(branches, to_move, depth):
    """OGS move_tree.branches -> app tree nodes. Even depth = player move,
    odd = forced opponent reply. A player move that leads to a correct_answer
    is on the solution line (untagged, or 'correct' leaf); one that does not is
    a 'wrong' decoy whose subtree becomes the refutation the engine plays out."""
    opp = "w" if to_move == "b" else "b"
    color = to_move if depth % 2 == 0 else opp
    out = []
    for br in branches:
        x, y = br.get("x", -1), br.get("y", -1)
        kids_src = br.get("branches", [])
        if x < 0 or y < 0:
            out += conv_tree(kids_src, to_move, depth)  # skip pass artifact
            continue
        node = {"at": coord(x, y), "by": color}
        kids = conv_tree(kids_src, to_move, depth + 1)
        if depth % 2 == 0:  # player move
            if br.get("correct_answer"):
                node["tag"] = "correct"          # solved here; truncate continuation
            elif has_correct_desc(br):
                if kids: node["children"] = kids  # correct intermediate move
                else: node["tag"] = "correct"
            else:
                node["tag"] = "wrong"             # decoy; keep refutation subtree
                if kids: node["children"] = kids
        else:  # opponent reply
            if kids: node["children"] = kids
        out.append(node)
    return out


def leads_to_solved(node):
    if node.get("tag") == "wrong":
        return False
    ch = node.get("children")
    if not ch:
        return node.get("tag") == "correct"
    return any(leads_to_solved(c) for c in ch)


def reorder(nodes, depth):
    """Engine follows children[0] as the forced opponent reply. At solver
    nodes (even depth), reorder the opponent replies so a solved-leading one
    is first — otherwise a multi-branch tesuji becomes unsolvable in-engine."""
    for n in nodes:
        ch = n.get("children")
        if not ch:
            continue
        if depth % 2 == 0 and len(ch) > 1:
            ch.sort(key=lambda c: not leads_to_solved(c))
        reorder(ch, depth + 1)


def has_solved_leaf(nodes):
    for n in nodes:
        if n.get("tag") == "wrong":
            continue
        if not n.get("children"):
            if n.get("tag") == "correct":
                return True
        elif has_solved_leaf(n["children"]):
            return True
    return False


def replay_ok(board, nodes, to_move, sz):
    """The principal correct line must replay with all-legal moves."""
    def walk(b, ns, color):
        for n in ns:
            if n.get("tag") == "wrong":
                continue
            x = ord(n["at"][0]) - 97; y = ord(n["at"][1]) - 97
            nb = play(b, y * sz + x, n["by"], sz)
            if nb is None:
                return False
            if not n.get("children"):
                return n.get("tag") == "correct" or color == to_move
            if walk(nb, n["children"], "w" if color == "b" else "b"):
                return True
        return False
    return walk(board, nodes, to_move)


def difficulty_from_rank(rank):
    return max(850, min(1500, 1000 + int(rank or 0) * 22))


# Некоторые коллекции («Absolute Basics I») смешивают механики; заголовок
# задачи надёжнее коллекции. Префикс-матч по титулу уточняет домен.
TITLE_DOMAIN = [("capture", "capture"), ("make life", "ld-live"), ("kill", "ld-kill")]


def refine_domain(domain, title):
    t = (title or "").lower()
    for prefix, d in TITLE_DOMAIN:
        if t.startswith(prefix):
            return d
    return domain


def main():
    from collections import Counter
    out, reasons = [], Counter()
    for cid, domain, label in COLLECTIONS:
        try:
            lst = get(f"https://online-go.com/api/v1/puzzles/?collection={cid}&page_size=100",
                      cache_key=f"coll-{cid}")
        except Exception as e:
            print(f"  [{cid}] {label}: FETCH FAIL {e}"); continue
        ok = rej = 0
        for row in lst.get("results", []):
            pid = row["id"]
            try:
                p = get(f"https://online-go.com/api/v1/puzzles/{pid}/", cache_key=f"pz-{pid}")
            except Exception:
                rej += 1; reasons["fetch-fail"] += 1; continue
            pz = p.get("puzzle") or {}
            w, h = pz.get("width"), pz.get("height")
            if w != h or w not in ALLOWED_SIZES:
                rej += 1; reasons[f"size-{w}x{h}"] += 1; continue
            sz = w
            to_move = "b" if (pz.get("initial_player") or "black") == "black" else "w"
            board = build_board(pz.get("initial_state") or {}, sz)
            if board.count(".") == sz * sz or not legal_position(board, sz):
                rej += 1; reasons["illegal-pos"] += 1; continue
            mt = pz.get("move_tree") or {}
            tree = conv_tree(mt.get("branches", []), to_move, 0)
            reorder(tree, 0)
            if not tree:
                rej += 1; reasons["empty-tree"] += 1; continue
            if not has_solved_leaf(tree):
                rej += 1; reasons["no-solved-leaf"] += 1; continue
            if not replay_ok(board, tree, to_move, sz):
                rej += 1; reasons["replay-fail"] += 1; continue
            rank = p.get("rank") or pz.get("puzzle_rank") or 0
            title = row.get("name") or pz.get("name") or "OGS"
            dom = refine_domain(domain, title)
            out.append({
                "id": f"ogs-{cid}-{pid}",
                "category": "ogs", "section": dom,
                "title": title,
                "to_move": to_move, "size": sz, "board": board,
                "domain": dom, "difficulty": difficulty_from_rank(rank),
                "tree": tree, "scaleVersion": "v2-2026-07-11",
                "marked_by": {"engine": "ogs-import", "collection": cid,
                              "collection_label": label,
                              "owner": (p.get("owner") or {}).get("username"),
                              "source": "online-go.com", "license": "personal-use-unverified"},
            })
            ok += 1
        print(f"  [{cid}] {label:32s} +{ok} valid / {rej} rejected")

    OUT.write_text(json.dumps({
        "board_size": 0, "source": "OGS puzzle API (personal-use, pre-publish clearance pending)",
        "categories": [{"id": "ogs", "title": "OGS",
                        "sections": [{"id": d, "title": d} for d in
                                     sorted({p["domain"] for p in out})]}],
        "problems": out}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\ntotal valid: {len(out)}  | rejections: {dict(reasons)}")
    print("by domain:", dict(Counter(p["domain"] for p in out)))
    print("by difficulty band:", dict(Counter(
        ("<1250" if p["difficulty"] < 1250 else "1250-1399" if p["difficulty"] < 1400 else "1400+")
        for p in out)))
    print("->", OUT)


if __name__ == "__main__":
    main()
