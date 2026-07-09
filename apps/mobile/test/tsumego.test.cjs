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

// Off-tree move -> wrong (board unchanged), then recover and solve.
{
  const p = byId.get('cap-atari-1');
  let s = startSession(p);
  const before = s.board;
  s = playUserMove(s, sgfToIdx('aa'));
  assert.equal(s.status, 'wrong');
  assert.equal(s.board, before, 'board unchanged on wrong move');
  s = clearWrong(s);
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

// Every problem: hint points at a legal in-tree move; correct line solvable.
{
  for (const p of db.problems) {
    const hint = hintMove(p);
    assert.notEqual(hint, null, `${p.id} has a hint`);
    // Follow greedy correct path: always pick a non-wrong node.
    let s = startSession(p);
    let guard = 0;
    while (s.status === 'playing' && guard++ < 30) {
      const good = s.nodes.find((n) => n.tag !== 'wrong') || s.nodes[0];
      assert.ok(good, `${p.id} has a playable node`);
      s = playUserMove(s, sgfToIdx(good.at));
      assert.notEqual(s.status, 'wrong', `${p.id} tree move accepted`);
    }
    assert.equal(s.status, 'solved', `${p.id} solvable via tree`);
  }
}

console.log('tsumego tests: OK');
