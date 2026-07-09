#!/usr/bin/env python3
"""Extract 9x9 Go opening move sequences from a SmartGo-style EPUB book.

The book's diagrams are embedded as inline SVG inside the chapter XHTML
files. Each stone is a `<use xlink:href="#b|#w">` element positioned on a
24px grid (first line at 12px), and move numbers are `<text>` elements
placed on top of the stones. This script walks the opening chapters,
reconstructs every diagram as structured data, and writes:

  - data/openings/9x9/openings.json   master index (families -> openings -> diagrams)
  - data/openings/9x9/sgf/...         one SGF file per diagram

Only factual game data is extracted (stone coordinates, move order,
point labels, markers, captions and section names). The book's prose
commentary is intentionally NOT copied.

Usage:
    python3 scripts/extract_epub_openings.py path/to/book.epub [output_dir]
"""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

XHTML_NS = "http://www.w3.org/1999/xhtml"
SVG_NS = "http://www.w3.org/2000/svg"
XLINK_NS = "http://www.w3.org/1999/xlink"
GB_NS = "https://gobooks.com"

GRID_ORIGIN = 12.0
GRID_STEP = 24.0
BOARD_SIZE = 9

# Chapters that contain the opening repertoire. Key = file inside OPS/,
# value = opening family name used in the output.
OPENING_CHAPTERS = {
    "c3.xhtml": "tengen",
    "c4.xhtml": "hoshi",
    "c5.xhtml": "takamoku",
    "c6.xhtml": "territorial",
}

MARKER_KINDS = {
    "tb": "triangle",  # white-stroked triangle (drawn on black stones)
    "tw": "triangle",  # black-stroked triangle (on white stones / empty points)
    "sb": "square",
    "sw": "square",
    "gc": "gray-dot",  # territory/score dots
    "ib": "dot",
    "iw": "dot",
}

GTP_COLS = "ABCDEFGHJ"  # 'I' is skipped by convention


def q(tag: str, ns: str = XHTML_NS) -> str:
    return f"{{{ns}}}{tag}"


def px_to_index(value: str) -> int | None:
    """Convert an SVG pixel coordinate to a 0-based board index."""
    idx = (float(value) - GRID_ORIGIN) / GRID_STEP
    rounded = round(idx)
    if abs(idx - rounded) > 0.01 or not (0 <= rounded < BOARD_SIZE):
        return None
    return rounded


def to_sgf_coord(col: int, row: int) -> str:
    return chr(ord("a") + col) + chr(ord("a") + row)


def to_gtp_coord(col: int, row: int) -> str:
    return f"{GTP_COLS[col]}{BOARD_SIZE - row}"


def element_text(el) -> str:
    return " ".join(" ".join(el.itertext()).split())


def parse_heading(text: str) -> tuple[str, int | None]:
    """Split an h3 like 'Curveball ☆★★' into (name, difficulty 1-3)."""
    stars = text.count("★")
    name = text.replace("★", "").replace("☆", "").strip()
    return name, (stars or None)


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "unnamed"


def parse_caption(caption: str) -> dict:
    """Pull the result annotation out of captions like 'Sword diagram 3 (W+)'.

    Captions may carry trailing notes after the result, e.g.
    'Windmill diagram 8 (=) 18: connects'.
    """
    info = {"caption": caption, "result": None}
    m = re.search(r"\(([=BW]\+?)\)", caption)
    if m:
        raw = m.group(1).strip()
        info["result"] = {"=": "even"}.get(raw, raw)
        info["caption"] = " ".join((caption[: m.start()] + caption[m.end():]).split())
    return info


def parse_svg(svg) -> dict | None:
    """Extract stones, move numbers, labels and markers from one diagram SVG."""
    stones: list[dict] = []
    numbers: list[dict] = []
    labels: list[dict] = []
    markers: list[dict] = []

    for el in svg.iter():
        tag = el.tag
        if tag == q("use", SVG_NS):
            href = (el.get(f"{{{XLINK_NS}}}href") or "").lstrip("#")
            col = px_to_index(el.get("x", ""))
            row = px_to_index(el.get("y", ""))
            if col is None or row is None:
                continue
            if href in ("b", "w"):
                # A point can hold several stones over the diagram's lifetime
                # (stone captured, then played on again), so keep a list.
                stones.append({"color": href, "col": col, "row": row})
            elif href in MARKER_KINDS:
                markers.append({"col": col, "row": row, "kind": MARKER_KINDS[href]})
            # '#h' star points and other decorations are ignored
        elif tag == q("text", SVG_NS):
            col = px_to_index(el.get("x", ""))
            row = px_to_index(el.get("y", ""))
            if col is None or row is None:
                continue
            content = element_text(el)
            if not content:
                continue
            if content.isdigit():
                # White text sits on black stones and vice versa.
                on_color = "b" if "wt" in (el.get("class") or "") else "w"
                numbers.append({"col": col, "row": row, "n": int(content), "on": on_color})
            else:
                labels.append({"col": col, "row": row, "text": content})

    if not stones and not numbers:
        return None  # not a board diagram (e.g. stats image wrapper)

    moves = []
    floating_numbers = []  # numbers with no stone under them ("5 at 1" cases)
    for num in numbers:
        stone = next(
            (s for s in stones
             if (s["col"], s["row"]) == (num["col"], num["row"])
             and s["color"] == num["on"] and "n" not in s),
            None,
        )
        if stone is not None:
            stone["n"] = num["n"]
        else:
            floating_numbers.append(num)

    setup = {"b": [], "w": []}
    for stone in sorted(stones, key=lambda s: (s.get("n", 0), s["col"], s["row"])):
        coord = to_sgf_coord(stone["col"], stone["row"])
        entry = {
            "coord": coord,
            "gtp": to_gtp_coord(stone["col"], stone["row"]),
            "color": stone["color"],
        }
        if "n" in stone:
            entry["n"] = stone["n"]
            moves.append(entry)
        else:
            setup[stone["color"]].append(coord)

    moves.sort(key=lambda m: m["n"])

    return {
        "setup_black": setup["b"],
        "setup_white": setup["w"],
        "moves": moves,
        "labels": [
            {"coord": to_sgf_coord(l["col"], l["row"]), "gtp": to_gtp_coord(l["col"], l["row"]), "text": l["text"]}
            for l in labels
        ],
        "markers": [
            {"coord": to_sgf_coord(m["col"], m["row"]), "gtp": to_gtp_coord(m["col"], m["row"]), "kind": m["kind"]}
            for m in markers
        ],
        "floating_numbers": [
            {"coord": to_sgf_coord(n["col"], n["row"]), "n": n["n"]} for n in floating_numbers
        ],
    }


def diagram_to_sgf(diagram: dict, name: str) -> str:
    props = [f"GM[1]FF[4]CA[UTF-8]SZ[{BOARD_SIZE}]GN[{name}]"]
    if diagram["setup_black"]:
        props.append("AB" + "".join(f"[{c}]" for c in diagram["setup_black"]))
    if diagram["setup_white"]:
        props.append("AW" + "".join(f"[{c}]" for c in diagram["setup_white"]))
    if diagram["labels"]:
        props.append("LB" + "".join(f"[{l['coord']}:{l['text']}]" for l in diagram["labels"]))
    triangles = [m for m in diagram["markers"] if m["kind"] == "triangle"]
    squares = [m for m in diagram["markers"] if m["kind"] == "square"]
    if triangles:
        props.append("TR" + "".join(f"[{m['coord']}]" for m in triangles))
    if squares:
        props.append("SQ" + "".join(f"[{m['coord']}]" for m in squares))
    comments = []
    if diagram.get("result"):
        comments.append(f"Result: {diagram['result']}")
    for fn in diagram["floating_numbers"]:
        comments.append(f"Move {fn['n']} at {fn['coord']}")
    if comments:
        props.append("C[" + "\n".join(comments) + "]")

    nodes = ["".join(props)]
    for mv in diagram["moves"]:
        color = "B" if mv["color"] == "b" else "W"
        node = f"{color}[{mv['coord']}]"
        if mv is diagram["moves"][0] and mv["n"] != 1:
            node += f"MN[{mv['n']}]"
        nodes.append(node)
    return "(;" + ";".join(nodes) + ")"


def extract_chapter(source: str, family: str) -> dict:
    """Parse one chapter XHTML and group its diagrams by opening (h3 section)."""
    # ElementTree chokes on undeclared entities rarely; the files are clean XML.
    root = ET.fromstring(source)
    body = root.find(q("body"))
    chapter_title = ""
    openings: list[dict] = []
    current: dict | None = None
    fig_counter = 0

    def flush_current():
        nonlocal current
        if current and current["diagrams"]:
            openings.append(current)

    for el in body.iter():
        if el.tag == q("h2"):
            chapter_title = element_text(el)
        elif el.tag == q("h3"):
            flush_current()
            name, difficulty = parse_heading(element_text(el))
            current = {
                "name": name,
                "slug": slugify(name),
                "difficulty": difficulty,
                "diagrams": [],
            }
        elif el.tag == q("figure"):
            fig_counter += 1
            svg = el.find(q("svg", SVG_NS))
            if svg is None:
                continue
            diagram = parse_svg(svg)
            if diagram is None:
                continue
            caption_el = el.find(q("figcaption"))
            cap = parse_caption(element_text(caption_el) if caption_el is not None else "")
            diagram["caption"] = cap["caption"]
            diagram["result"] = cap["result"]
            diagram["id"] = el.get("id") or f"{family}-fig{fig_counter:03d}"
            if current is None:
                current = {
                    "name": f"{chapter_title or family} — preamble",
                    "slug": "preamble",
                    "difficulty": None,
                    "diagrams": [],
                }
            current["diagrams"].append(diagram)

    flush_current()
    return {"family": family, "chapter_title": chapter_title, "openings": openings}


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    epub_path = Path(sys.argv[1])
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("data/openings/9x9")
    sgf_dir = out_dir / "sgf"

    index = {
        "source": epub_path.name,
        "board_size": BOARD_SIZE,
        "coordinate_system": "sgf (a-i left to right, a-i top to bottom); gtp uses A-J skipping I, rows 9-1",
        "families": [],
    }
    total_diagrams = 0
    total_moves = 0

    with zipfile.ZipFile(epub_path) as zf:
        for filename, family in OPENING_CHAPTERS.items():
            source = zf.read(f"OPS/{filename}").decode("utf-8")
            chapter = extract_chapter(source, family)
            index["families"].append(chapter)

            for opening in chapter["openings"]:
                target = sgf_dir / family / opening["slug"]
                target.mkdir(parents=True, exist_ok=True)
                for i, diagram in enumerate(opening["diagrams"], 1):
                    sgf_name = f"{opening['slug']}-{i:02d}"
                    sgf = diagram_to_sgf(diagram, f"{opening['name']} — {diagram['caption']}")
                    (target / f"{sgf_name}.sgf").write_text(sgf, encoding="utf-8")
                    diagram["sgf"] = str((target / f"{sgf_name}.sgf").relative_to(out_dir))
                    total_diagrams += 1
                    total_moves += len(diagram["moves"])

    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "openings.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    for fam in index["families"]:
        n_diag = sum(len(o["diagrams"]) for o in fam["openings"])
        print(f"{fam['family']:12s} {fam['chapter_title'][:40]:42s} openings={len(fam['openings']):3d} diagrams={n_diag}")
    print(f"\nTotal: {total_diagrams} diagrams, {total_moves} moves -> {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
