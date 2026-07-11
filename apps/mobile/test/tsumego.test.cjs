// Node tests for the tsumego solving engine against the seed set.
// Run from apps/mobile:  node test/tsumego.test.cjs

const assert = require('node:assert/strict');
const { sgfToIdx } = require('../src/engine/board');
const {
  startSession, playUserMove, clearWrong, hintMove,
} = require('../src/engine/tsumego');
const db = require('../src/data/tsumego.json');

const byId = new Map(db.problems.map((p) => [p.id, p]));

// Simple capture problem: single correct move solves it.
{
  const p = byId.get('cap-atari-1');
  let s = startSession(p);
  s = playUserMove(s, sgfToIdx('ef'));
  assert.equal(s.status, 'solved', 'atari solved by ef');
  assert.equal(s.board[sgfToIdx('ee')], '.', 'white stone captured');
}

// Off-tree move -> wrong: the stone IS placed (visual feedback), then
// clearWrong lifts it back off and the problem is still solvable.
{
  const p = byId.get('cap-atari-1');
  let s = startSession(p);
  const before = s.board;
  s = playUserMove(s, sgfToIdx('aa'));
  assert.equal(s.status, 'wrong');
  assert.notEqual(s.board, before, 'wrong stone appears on the board');
  assert.equal(s.wrongAt, sgfToIdx('aa'), 'wrong point remembered');
  s = clearWrong(s);
  assert.equal(s.board, before, 'clearWrong lifts the stone');
  s = playUserMove(s, sgfToIdx('ef'));
  assert.equal(s.status, 'solved');
}

// Multi-move line: double atari — white saves one side, black captures other.
{
  const p = byId.get('cap-double-atari');
  let s = startSession(p);
  s = playUserMove(s, sgfToIdx('de'));
  assert.equal(s.status, 'playing', 'white replied');
  assert.equal(s.moves.length, 2, 'user move + auto-reply');
  const answer = s.nodes[0]; // whichever side white saved, tree offers the capture
  s = playUserMove(s, sgfToIdx(answer.at));
  assert.equal(s.status, 'solved');
}

// Marked-wrong move plays out the refutation and fails.
{
  const p = byId.get('ld-corner-bent3-live');
  let s = startSession(p);
  s = playUserMove(s, sgfToIdx('ba'));
  assert.equal(s.status, 'refuted', 'wrong vital point is refuted');
  assert.ok(s.moves.length >= 2, 'refutation played out');
}

// Ladder: full 5-move sequence captures three stones.
{
  const p = byId.get('cap-ladder');
  let s = startSession(p);
  for (const mv of ['hd', 'id', 'ia']) {
    s = playUserMove(s, sgfToIdx(mv));
    assert.notEqual(s.status, 'wrong', `ladder move ${mv} accepted`);
  }
  assert.equal(s.status, 'solved', 'ladder solved');
}

// Every tree problem: hint points at a legal move; correct line solvable.
{
  let treeCount = 0;
  let freeCount = 0;
  for (const p of db.problems) {
    const size = p.size || 9;
    assert.equal(p.board.length, size * size, `${p.id} board length matches size`);
    if (!p.tree || p.tree.length === 0) {
      freeCount++;
      continue;
    }
    treeCount++;
    const hint = hintMove(p);
    assert.notEqual(hint, null, `${p.id} has a hint`);
    // Follow greedy correct path: always pick a non-wrong node.
    let s = startSession(p);
    let guard = 0;
    while (s.status === 'playing' && guard++ < 30) {
      const good = s.nodes.find((n) => n.tag !== 'wrong') || s.nodes[0];
      assert.ok(good, `${p.id} has a playable node`);
      s = playUserMove(s, sgfToIdx(good.at, size));
      assert.notEqual(s.status, 'wrong', `${p.id} tree move accepted`);
    }
    assert.equal(s.status, 'solved', `${p.id} solvable via tree`);
  }
  assert.ok(treeCount >= 900, `most problems auto-marked & solvable (${treeCount})`);
  assert.ok(db.problems.length >= 1000, `full classical corpus present (${db.problems.length})`);
}

// Free-solve mode: 19x19 problem accepts alternating moves and undo works.
{
  const p = db.problems.find((x) => (x.size || 9) === 19 && (!x.tree || !x.tree.length));
  assert.ok(p, 'a free-mode 19x19 problem exists');
  const { undoFreeMove, viewRect } = require('../src/engine/tsumego');
  let s = startSession(p);
  assert.equal(s.free, true);
  const size = 19;
  // Find two empty points inside the view rect and play them.
  const v = viewRect(p);
  const empties = [];
  for (let r = v.r0; r <= v.r1 && empties.length < 2; r++) {
    for (let c = v.c0; c <= v.c1 && empties.length < 2; c++) {
      if (p.board[r * size + c] === '.') empties.push(r * size + c);
    }
  }
  const firstToMove = s.toMove;
  s = playUserMove(s, empties[0]);
  assert.equal(s.status, 'playing');
  assert.notEqual(s.toMove, firstToMove, 'colors alternate in free mode');
  s = playUserMove(s, empties[1]);
  assert.equal(s.moves.length, 2);
  s = undoFreeMove(s);
  assert.equal(s.moves.length, 1, 'undo removed last move');
}

console.log('tsumego tests: OK');
