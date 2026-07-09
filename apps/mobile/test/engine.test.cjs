// Node test for the identification engine (no React Native needed).
// Run from apps/mobile:  node test/engine.test.cjs

const assert = require('node:assert/strict');
const { EMPTY_BOARD, play, sgfToIdx, idxToGtp } = require('../src/engine/board');
const { TRANSFORMS, transformIdx, canonical } = require('../src/engine/symmetry');
const {
  identify, suggestions, continuationMarks, currentBranch,
} = require('../src/engine/identify');
const db = require('../src/data/branches.json');

// --- captures ---------------------------------------------------------
{
  // White stone on the right edge gets surrounded and captured.
  let board = EMPTY_BOARD;
  board = play(board, sgfToIdx('ia'), 'w').board;
  board = play(board, sgfToIdx('ha'), 'b').board;
  const res = play(board, sgfToIdx('ib'), 'b');
  assert.equal(res.captures.length, 1, 'edge stone captured');
  assert.equal(res.board[sgfToIdx('ia')], '.', 'captured point emptied');
}

// --- identification of a rotated line ---------------------------------
{
  const target = db.branches.find((b) => b.opening === 'curveball' && b.line);
  assert.ok(target, 'curveball line exists');

  let board = EMPTY_BOARD;
  let identified = null;
  for (const mv of target.line) {
    const rotated = transformIdx('rot90', sgfToIdx(mv.coord));
    board = play(board, rotated, mv.color).board;
    const result = identify(board);
    assert.notEqual(result.status, 'unknown', 'in-book move recognized');
    if (result.status === 'identified') { identified = result; break; }
  }
  assert.ok(identified, 'line uniquely identified');
  assert.equal(identified.opening.name, 'Curveball');

  const branch = currentBranch(identified);
  assert.equal(branch.branch.opening, 'curveball');

  // Final position of the rotated line shows its letters at rotated points.
  let fin = EMPTY_BOARD;
  for (const mv of target.line) {
    fin = play(fin, transformIdx('rot90', sgfToIdx(mv.coord)), mv.color).board;
  }
  const res = identify(fin);
  const marks = continuationMarks(res);
  const letters = target.continuations.filter((c) => c.on === 'empty' && c.label);
  assert.ok(letters.length > 0, 'target diagram has letters');
  for (const c of letters) {
    const expected = transformIdx('rot90', sgfToIdx(c.coord));
    assert.ok(
      marks.some((m) => m.at === expected && m.label === c.label),
      `letter ${c.label} lands on rotated point ${idxToGtp(expected)}`
    );
  }
}

// --- unknown move ------------------------------------------------------
{
  const board = play(EMPTY_BOARD, sgfToIdx('aa'), 'b').board;
  assert.equal(identify(board).status, 'unknown', '1-1 point is off-book');
}

// --- suggestions -------------------------------------------------------
{
  // Tengen first move: many candidate openings, expect 3 distinct points.
  const board = play(EMPTY_BOARD, sgfToIdx('ee'), 'b').board;
  const result = identify(board);
  assert.equal(result.status, 'candidates');
  const sug = suggestions(result, 3);
  assert.equal(sug.length, 3, 'three suggested continuations');
}

// --- canonical is stable across all symmetries -------------------------
{
  const target = db.branches.find((b) => b.line && b.line.length >= 4);
  let base = EMPTY_BOARD;
  for (const mv of target.line.slice(0, 4)) {
    base = play(base, sgfToIdx(mv.coord), mv.color).board;
  }
  const canon = canonical(base).position;
  for (const name of Object.keys(TRANSFORMS)) {
    let b = EMPTY_BOARD;
    for (const mv of target.line.slice(0, 4)) {
      b = play(b, transformIdx(name, sgfToIdx(mv.coord)), mv.color).board;
    }
    assert.equal(canonical(b).position, canon, `canonical stable under ${name}`);
  }
}

console.log('engine tests: OK');
