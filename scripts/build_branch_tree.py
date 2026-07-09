#!/usr/bin/env python3
"""Build the branch tree for the 9x9 openings database.

Reads data/openings/9x9/openings.json (produced by extract_epub_openings.py)
and writes data/openings/9x9/branches.json with two things an app needs:

1. `branches` — every diagram becomes a numbered branch of its opening
   ("Sword, branch 3"). Where continuation links allow it, the full move
   line from the empty board is reconstructed by chaining parent diagrams,
   so a branch knows the exact ordered sequence that reaches it.

2. `position_index` — every position that any branch passes through, keyed
   by a symmetry-canonical board hash. Given the stones currently on the
   user's board, the app canonicalizes the position, looks it up here, and
   immediately knows which opening(s)/branch(es) the user is entering, whose
   move it is, and which continuation points (letters/triangles) to show —
   with the transform needed to map the diagram's coordinates onto the
   user's board orientation.

Usage:
    python3 scripts/build_branch_tree.py [data/openings/9x9]
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_epub_openings import (  # noqa: E402
    BOARD_SIZE, SYMMETRIES, coord_to_idx, play, replay_states,
)

INVERSE = {
    "identity": "identity",
    "rot90": "rot270",
    "rot180": "rot180",
    "rot270": "rot90",
    "flip_h": "flip_h",
    "flip_v": "flip_v",
    "transpose": "transpose",
    "anti_transpose": "anti_transpose",
}


def transform_position(pos: str, fn) -> str:
    out = ["."] * (BOARD_SIZE * BOARD_SIZE)
    for idx, stone in enumerate(pos):
        if stone != ".":
            row, col = divmod(idx, BOARD_SIZE)
            tc, tr = fn(col, row)
            out[tr * BOARD_SIZE + tc] = stone
    return "".join(out)


def canonical(pos: str) -> tuple[str, str]:
    """Return (canonical position, transform applied to reach it)."""
    best, best_name = pos, "identity"
    for name, fn in SYMMETRIES.items():
        if name == "identity":
            continue
        t = transform_position(pos, fn)
        if t < best:
            best, best_name = t, name
    return best, best_name


def main() -> int:
    data_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/openings/9x9")
    index = json.loads((data_dir / "openings.json").read_text(encoding="utf-8"))

    # Collect diagrams with replay info, assign branch numbers per opening.
    diagrams: dict[str, dict] = {}
    branches: list[dict] = []
    for fam in index["families"]:
        for op in fam["openings"]:
            for branch_no, d in enumerate(op["diagrams"], 1):
                states, seq = replay_states(d)
                branch_id = f"{fam['family']}/{op['slug']}/{branch_no}"
                diagrams[d["id"]] = {
                    "diagram": d,
                    "states": states,
                    "seq": seq,
                    "branch_id": branch_id,
                    "opening": op["slug"],
                    "opening_name": op["name"],
                    "family": fam["family"],
                    "branch_no": branch_no,
                    "order": len(diagrams),
                }

    # Parent edges from continuation links (same-orientation links only:
    # a rotated child cannot extend the parent's line coordinate-for-
    # coordinate, so it starts its own line).
    parents: dict[str, dict] = {}
    for info in diagrams.values():
        d = info["diagram"]
        for cont in d.get("continuations", []):
            nxt = cont.get("next")
            if not nxt or nxt["transform"] != "identity":
                continue
            child = nxt["diagram"]
            if child not in diagrams:
                continue
            edge = {
                "parent": d["id"],
                "coord": cont["coord"],
                "by": cont["by"],
                "label": cont["label"],
                "child_ply": nxt["ply"],
            }
            cur = parents.get(child)
            # Prefer a parent from the same opening, then earliest in the book.
            def rank(e):
                p = diagrams[e["parent"]]
                return (0 if p["opening"] == diagrams[child]["opening"] else 1, p["order"])
            if cur is None or rank(edge) < rank(cur):
                parents[child] = edge

    # Reconstruct full move lines from the empty board, chaining parents.
    def build_line(diag_id: str, visiting=None) -> list | None:
        info = diagrams[diag_id]
        if "line" in info:
            return info["line"]
        visiting = visiting or set()
        if diag_id in visiting:  # transposition cycle guard
            return None
        visiting.add(diag_id)
        d, seq = info["diagram"], info["seq"]
        edge = parents.get(diag_id)
        line = None
        if edge is not None:
            parent_line = build_line(edge["parent"], visiting)
            if parent_line is not None:
                # parent line + the branching move + this diagram's tail
                line = parent_line + [
                    {"color": edge["by"], "coord": edge["coord"]}
                ] + [{"color": m["color"], "coord": m["coord"]} for m in seq[edge["child_ply"]:]]
        elif not d["setup_black"] and not d["setup_white"]:
            line = [{"color": m["color"], "coord": m["coord"]} for m in seq]
        info["line"] = line
        return line

    for diag_id in diagrams:
        build_line(diag_id)

    # Sanity: a reconstructed line must replay to the diagram's final position.
    bad = 0
    for info in diagrams.values():
        if info["line"] is None:
            continue
        board = ["."] * (BOARD_SIZE * BOARD_SIZE)
        for mv in info["line"]:
            board = play(board, coord_to_idx(mv["coord"]), mv["color"])
        if "".join(board) != info["states"][-1]:
            bad += 1
            info["line"] = None
    if bad:
        print(f"warning: {bad} reconstructed lines failed replay check; dropped")

    # Emit branches + canonical position index.
    position_index: dict[str, list] = {}
    out_branches = []
    for info in sorted(diagrams.values(), key=lambda i: i["order"]):
        d = info["diagram"]
        edge = parents.get(d["id"])
        out_branches.append({
            "branch_id": info["branch_id"],
            "family": info["family"],
            "opening": info["opening"],
            "opening_name": info["opening_name"],
            "branch_no": info["branch_no"],
            "diagram": d["id"],
            "caption": d["caption"],
            "result": d["result"],
            "to_move": d["to_move"],
            # This diagram's own numbered moves; position_index plies refer
            # to prefixes of this list (ply p = position after moves[:p]).
            "moves": [{"color": m["color"], "coord": m["coord"]} for m in info["seq"]],
            "setup_black": d["setup_black"],
            "setup_white": d["setup_white"],
            "line": info["line"],           # full ordered moves from empty board, or null
            "line_len": len(info["line"]) if info["line"] else None,
            "parent": (
                {
                    "branch_id": diagrams[edge["parent"]]["branch_id"],
                    "via_label": edge["label"],
                    "coord": edge["coord"],
                }
                if edge else None
            ),
            "continuations": d.get("continuations", []),
        })
        for ply, pos in enumerate(info["states"]):
            canon, tf = canonical(pos)
            position_index.setdefault(canon, []).append({
                "branch_id": info["branch_id"],
                "ply": ply,
                "final": ply == len(info["states"]) - 1,
                # Apply this transform to DIAGRAM coordinates to express them
                # in canonical orientation; the app composes it with the
                # inverse of its own canonicalization transform.
                "to_canonical": tf,
            })

    out = {
        "board_size": BOARD_SIZE,
        "symmetries": list(SYMMETRIES.keys()),
        "inverse_transforms": INVERSE,
        "branch_count": len(out_branches),
        "lines_reconstructed": sum(1 for b in out_branches if b["line"]),
        "position_count": len(position_index),
        "branches": out_branches,
        "position_index": position_index,
    }
    (data_dir / "branches.json").write_text(
        json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"branches: {out['branch_count']}, full lines: {out['lines_reconstructed']}, "
          f"indexed positions: {out['position_count']}")
    empty_key = canonical("." * 81)[0]
    print("empty-board entry points:", len(position_index.get(empty_key, [])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
