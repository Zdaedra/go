# 9×9 Go Openings Database

Machine-readable move-sequence data for 9×9 openings, extracted from the
diagrams of a personally-owned EPUB Go book with
`scripts/extract_epub_openings.py`. Only factual game data is stored here
(stone coordinates, move order, point labels, markers, diagram captions and
opening names) — the book's prose commentary is not included.

## Contents

- `openings.json` — master index. Four opening families, each with its
  openings and every diagram's full move data:
  - `tengen` (Chapter 3) — Sword, Orthodox, Windmill, Hand Fan, Curveball,
    Soccer Juggling, Jump Attack, Cross Line, Almost Equilateral 1–3,
    Headbutt, Pendulum, Side Attachment, …
  - `hoshi` (Chapter 4) — Black Boomerang, Bean Throwing, Big Flower, Flower,
    Lunar Eclipse, Blackjack, Swing, Horse Head, Airship, Submarine, …
  - `takamoku` (Chapter 5) — New Orthodox, Andromeda, Slider,
    Secret Agent 033, White Slice, Kodachi, Jump Attachment!, Zazen, Boots, …
  - `territorial` (Chapter 6) — Mokuhazushi lines, Komoku, Sansan, …
- `sgf/<family>/<opening-slug>/<opening-slug>-NN.sgf` — one SGF per diagram,
  loadable in any SGF editor or engine tooling.

## Data model (per diagram)

```json
{
  "id": "tengen-fig029",
  "caption": "Curveball diagram 1",
  "result": "even",                  // "even" | "B+" | "W+" | null
  "setup_black": ["ee"],             // unnumbered stones already on the board
  "setup_white": [],
  "moves": [
    {"n": 1, "color": "b", "coord": "ee", "gtp": "E5"}
  ],
  "labels":  [{"coord": "dg", "gtp": "D3", "text": "A"}],
  "markers": [{"coord": "fg", "gtp": "F3", "kind": "triangle"}],
  "floating_numbers": [],            // "move N at point" notes (recaptures/ko)
  "sgf": "sgf/tengen/curveball/curveball-01.sgf"
}
```

Coordinates use SGF convention (`a`–`i`, left→right / top→bottom); `gtp`
gives the human-readable form (columns `A`–`J` skipping `I`, rows 9–1).

**Continuation semantics.** The `labels` (letters A, B, C, …) and
`markers` (triangles/squares) shown at a diagram's final position mark the
candidate *next moves* — the branch points where the opening continues into
the variations discussed around that diagram. Downstream tooling should
treat them as the diagram's continuation set, keyed by coordinate.
Continuation diagrams start numbering where the previous diagram left off
(the first SGF move then carries an `MN[..]` property).

Difficulty (from the book's star ratings): `1` = beginner-friendly,
`2` = intermediate, `3` = advanced, `null` = unrated / not recommended.

## Regenerating

```sh
python3 scripts/extract_epub_openings.py path/to/book.epub data/openings/9x9
```

The source EPUB is not committed to the repository.
