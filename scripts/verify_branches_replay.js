#!/usr/bin/env node
// Replay-verify every branch of the openings database with the app engine
// (apps/mobile/src/engine/board.js), enforcing the data contract that
// OpeningScreen relies on:
//
//   - branch.moves replays from the diagram's setup position (setup_black /
//     setup_white placed first) — NOT from the empty board. Diagrams deep in
//     an opening legitimately capture stones and replay on the freed points
//     (tengen/windmill/8 «18: connects» reoccupies a captured setup-era
//     point; takamoku/andromeda/5 ends with a corner snapback on A9), so a
//     setup-less replay reports false illegal moves on perfectly good data.
//   - branch.line (when present) replays from the empty board and must land
//     on the same final position as the setup+moves replay.
//
// Checks per branch: setup stones don't overlap; every move is legal for
// play() (occupied points and suicide both come back null); line and
// setup+moves agree on the final position. Exit code 1 on any failure.
//
// Usage: node scripts/verify_branches_replay.js [path/to/branches.json]

const path = require('path');
const ENGINE = path.join(__dirname, '..', 'apps', 'mobile', 'src', 'engine');
const { play, sgfToIdx, EMPTY_BOARD } = require(path.join(ENGINE, 'board'));

const dbPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ENGINE, '..', 'data', 'branches.json');
const db = require(dbPath);

const errors = [];
let withLine = 0;
let capturedStones = 0;
let branchesWithCaptures = 0;

function replay(board, moves, label, branchId) {
  let captures = 0;
  for (let i = 0; i < moves.length; i++) {
    const mv = moves[i];
    const next = play(board, sgfToIdx(mv.coord), mv.color);
    if (!next) {
      errors.push(`${branchId}: ${label} move ${i + 1}/${moves.length} (${mv.color} ${mv.coord}) is illegal`);
      return null;
    }
    captures += next.captures.length;
    board = next.board;
  }
  return { board, captures };
}

for (const b of db.branches) {
  const cells = EMPTY_BOARD.split('');
  let setupOk = true;
  for (const [color, coords] of [['b', b.setup_black], ['w', b.setup_white]]) {
    for (const c of coords) {
      const at = sgfToIdx(c);
      if (cells[at] !== '.') {
        errors.push(`${b.branch_id}: setup ${color} ${c} overlaps another stone`);
        setupOk = false;
      }
      cells[at] = color;
    }
  }
  if (!setupOk) continue;

  const fromSetup = replay(cells.join(''), b.moves, 'moves', b.branch_id);
  if (fromSetup && fromSetup.captures > 0) {
    branchesWithCaptures++;
    capturedStones += fromSetup.captures;
  }

  if (b.line) {
    withLine++;
    const fromEmpty = replay(EMPTY_BOARD, b.line, 'line', b.branch_id);
    if (fromSetup && fromEmpty && fromSetup.board !== fromEmpty.board) {
      errors.push(`${b.branch_id}: line final position differs from setup+moves replay`);
    }
  }
}

console.log(`branches: ${db.branches.length}, with full line: ${withLine}, ` +
  `branches whose moves capture: ${branchesWithCaptures} (${capturedStones} stones)`);
if (errors.length) {
  console.log(`replay errors: ${errors.length}`);
  for (const e of errors) console.log(' ', e);
} else {
  console.log('replay errors: 0');
}
process.exitCode = errors.length ? 1 : 0;
