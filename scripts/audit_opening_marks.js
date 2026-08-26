#!/usr/bin/env node
// Audit every tappable mark (triangles / letters / dots) on every book
// position, simulating PlayScreen's exact logic. A mark must never lead
// to the «not in base» state: it either advances deeper into the book
// (identified/candidates) or completes the opening (unknown + viaBook →
// "Дебют пройден полностью — {name}").
//
// Orphan classes reported:
//   ORPHAN_NOT_IN_BASE — tap ends 'unknown' with viaBook=false (user-visible bug)
//   ORPHAN_ILLEGAL     — mark sits on an illegal point (play() rejects)
//   DATA_BROKEN_CHAIN  — continuation declares next=<diagram> but the
//                        resulting position is not in the index
//   COLOR_FALLBACK     — orbit-expanded triangle whose color the UI would
//                        have to guess from toMove (provenance lost)
//
// Usage: node scripts/audit_opening_marks.js [--json out.json] [--legacy]
//   default   models PlayScreen's markMeta logic (every rendered mark
//             carries its book color + viaBook) — must give 0 orphans
//   --legacy  models the pre-fix placeStone (exact-at lookup only), which
//             reproduced the orphan-triangle bug on mirrored copies

const path = require('path');
const ENGINE = path.join(__dirname, '..', 'apps', 'mobile', 'src', 'engine');
const { play, sgfToIdx } = require(path.join(ENGINE, 'board'));
const { stabilizer, orbit, transformIdx } = require(path.join(ENGINE, 'symmetry'));
const { identify, suggestions, continuationMarks } = require(path.join(ENGINE, 'identify'));
const db = require(path.join(ENGINE, '..', 'data', 'branches.json'));

const SIMULATE_FIX = !process.argv.includes('--legacy');
const jsonArg = process.argv.indexOf('--json');
const JSON_OUT = jsonArg > -1 ? process.argv[jsonArg + 1] : null;

// toMove the way PlayScreen derives it from alternation (b first).
// Book setups can break parity; that's fine — we only use this where the
// UI itself would (orbit-copy fallback), and we flag those taps anyway.
function toMoveOf(pos) {
  let nb = 0, nw = 0;
  for (const ch of pos) { if (ch === 'b') nb++; else if (ch === 'w') nw++; }
  return nb <= nw ? 'b' : 'w';
}

const stats = {
  positions: 0, symmetricPositions: 0, taps: 0,
  OK_DEEPER: 0, OK_COMPLETED: 0,
  ORPHAN_NOT_IN_BASE: 0, ORPHAN_ILLEGAL: 0, DATA_BROKEN_CHAIN: 0,
  COLOR_FALLBACK: 0,
};
const orphans = [];

for (const canon of Object.keys(db.position_index)) {
  const P = canon; // canonical string is a valid user orientation
  // The empty preamble diagram sits in the index but is unreachable via
  // identify() (empty short-circuits before the lookup) — not tappable.
  if (!P.includes('b') && !P.includes('w')) continue;
  const result = identify(P);
  if (result.status === 'unknown' || result.status === 'empty') {
    orphans.push({ class: 'INDEX_INCONSISTENT', position: P });
    continue;
  }
  stats.positions++;

  const fullMarks = continuationMarks(result);
  const bookMoves = suggestions(result, 99);
  const base = fullMarks.length
    ? fullMarks.map((m) => ({ at: m.at, kind: m.kind, by: m.by, next: m.next, src: 'mark' }))
    : bookMoves.map((s) => ({ at: s.at, kind: 'dot', by: s.color, next: undefined, src: 'book' }));

  const stab = stabilizer(P);
  let taps; // [{at, srcMark, isOrbitCopy}]
  if (stab.length <= 1) {
    taps = base.map((mk) => ({ at: mk.at, srcMark: mk, isOrbitCopy: false }));
  } else {
    stats.symmetricPositions++;
    const seen = new Set();
    taps = [];
    for (const mk of base) {
      for (const at of orbit(mk.at, stab)) {
        if (seen.has(at)) continue;
        seen.add(at);
        taps.push({ at, srcMark: mk, isOrbitCopy: at !== mk.at });
      }
    }
  }

  for (const tap of taps) {
    stats.taps++;
    // Replicate placeStone: exact-at lookup only (this is the bug source).
    const exactMark = fullMarks.find((m) => m.at === tap.at);
    const exactBook = bookMoves.find((s) => s.at === tap.at);
    let color, viaBook;
    if (SIMULATE_FIX) {
      color = tap.srcMark.by || toMoveOf(P);
      viaBook = true; // markMeta carries provenance for every rendered mark
    } else {
      color = exactMark?.by === 'b' || exactMark?.by === 'w' ? exactMark.by
        : exactBook ? exactBook.color
        : toMoveOf(P);
      viaBook = Boolean(exactMark || exactBook);
      if (!exactMark && !exactBook) stats.COLOR_FALLBACK++;
    }

    const next = play(P, tap.at, color);
    if (!next) {
      stats.ORPHAN_ILLEGAL++;
      orphans.push({ class: 'ORPHAN_ILLEGAL', position: P, at: tap.at, kind: tap.srcMark.kind });
      continue;
    }
    const res2 = identify(next.board);
    const advanced = res2.status === 'identified' || res2.status === 'candidates';

    if (advanced) {
      stats.OK_DEEPER++;
    } else if (viaBook) {
      stats.OK_COMPLETED++;
    } else {
      stats.ORPHAN_NOT_IN_BASE++;
      orphans.push({
        class: 'ORPHAN_NOT_IN_BASE', position: P, at: tap.at,
        kind: tap.srcMark.kind, isOrbitCopy: tap.isOrbitCopy,
        srcAt: tap.srcMark.at, srcBy: tap.srcMark.by ?? null,
        playedColor: color, stabSize: stab.length,
      });
    }

    // Data-level chain check: book promises a next diagram but the
    // position after the marked move is unknown to the index.
    if (tap.srcMark.next && !tap.isOrbitCopy && !advanced) {
      stats.DATA_BROKEN_CHAIN++;
      orphans.push({
        class: 'DATA_BROKEN_CHAIN', position: P, at: tap.at,
        kind: tap.srcMark.kind, next: tap.srcMark.next,
      });
    }
  }
}

console.log(`mode: ${SIMULATE_FIX ? 'CURRENT (markMeta provenance)' : 'LEGACY (pre-fix, exact-at lookup)'}`);
console.log(JSON.stringify(stats, null, 1));
const byClass = {};
for (const o of orphans) byClass[o.class] = (byClass[o.class] || 0) + 1;
console.log('orphans by class:', JSON.stringify(byClass));
for (const o of orphans.slice(0, 12)) console.log(' ', JSON.stringify(o));
if (orphans.length > 12) console.log(`  ... and ${orphans.length - 12} more`);
if (JSON_OUT) {
  require('fs').writeFileSync(JSON_OUT, JSON.stringify({ stats, orphans }, null, 1));
  console.log('full report →', JSON_OUT);
}
process.exitCode = orphans.some((o) => o.class !== 'COLOR_FALLBACK') ? 1 : 0;
