// Tests for the KataGo opening evaluations lookup (engine/evals.js).
// Run from apps/mobile:  node test/evals.test.cjs

const assert = require('node:assert/strict');
const db = require('../src/data/opening_evals.json');
const { evalFor } = require('../src/engine/evals');
const {
  transformPosition, transformIdx, stabilizer,
} = require('../src/engine/symmetry');

if (!db.position_count) {
  console.log('evals tests: SKIPPED (opening_evals.json not merged yet)');
  process.exit(0);
}

// Every stored eval: best moves land on empty points, winrates sane.
{
  let checked = 0;
  for (const [canon, perSide] of Object.entries(db.positions)) {
    for (const side of Object.keys(perSide)) {
      for (const m of perSide[side].best) {
        assert.equal(canon[m.at], '.', 'best move on an empty point');
        assert.ok(m.winrate >= 0 && m.winrate <= 1, 'winrate in [0,1]');
      }
      checked++;
    }
  }
  assert.ok(checked >= 1500, `most units merged (${checked})`);
}

// Identity orientation: looking up a canonical position returns its own
// stored best move.
const sample = Object.entries(db.positions).find(
  ([canon, perSide]) => stabilizer(canon).length === 1 && perSide.B
);
assert.ok(sample, 'an asymmetric canonical position with B to move exists');
{
  const [canon, perSide] = sample;
  const ev = evalFor(canon, 'b');
  assert.ok(ev, 'eval found for canonical orientation');
  assert.equal(ev.best[0].at, perSide.B.best[0].at, 'identity mapping');
}

// Rotated orientation: the same position rotated 90° must yield the same
// best move rotated 90°.
{
  const [canon, perSide] = sample;
  const rotated = transformPosition(canon, 'rot90');
  const ev = evalFor(rotated, 'b');
  assert.ok(ev, 'eval found for rotated orientation');
  assert.equal(
    ev.best[0].at,
    transformIdx('rot90', perSide.B.best[0].at),
    'best move follows the board rotation'
  );
}

// Unknown position → null, not a crash.
{
  const junk = 'b'.repeat(3) + '.'.repeat(78);
  assert.equal(evalFor(junk, 'w'), null);
}

console.log('evals tests: OK');
