// Symmetry invariance: identification and suggestions must not depend on
// the orientation the user happens to play in. Every branch is replayed
// under all 7 non-identity transforms; at every ply the recognized opening
// set must match, and the suggested moves must be the same set after
// mapping back — up to the symmetry group of the position itself (early
// positions can be self-symmetric, where several answers are equivalent).

const assert = require('assert');
const db = require('../src/data/branches.json');
const { identify, suggestions } = require('../src/engine/identify');
const { EMPTY_BOARD, play, sgfToIdx } = require('../src/engine/board');
const {
  TRANSFORMS, transformIdx, transformPosition,
} = require('../src/engine/symmetry');

const NON_IDENTITY = Object.keys(TRANSFORMS).filter((t) => t !== 'identity');

function stabilizer(pos) {
  return Object.keys(TRANSFORMS).filter((t) => transformPosition(pos, t) === pos);
}

function openingKey(r) {
  return r.openings.map((o) => `${o.family}/${o.opening}`).sort().join(',');
}

let checked = 0;

for (const br of db.branches) {
  for (const t of NON_IDENTITY) {
    let pA = EMPTY_BOARD;
    let pB = EMPTY_BOARD;
    for (let i = 0; i < br.moves.length; i++) {
      const mv = br.moves[i];
      const idx = sgfToIdx(mv.coord);
      const a = play(pA, idx, mv.color);
      const b = play(pB, transformIdx(t, idx), mv.color);
      if (!a || !b) break;
      pA = a.board;
      pB = b.board;

      const rA = identify(pA);
      const rB = identify(pB);
      assert.strictEqual(
        rB.status, rA.status,
        `${br.branch_id} ${t} ply ${i + 1}: status ${rA.status} vs ${rB.status}`
      );
      assert.strictEqual(
        openingKey(rB), openingKey(rA),
        `${br.branch_id} ${t} ply ${i + 1}: opening sets differ`
      );

      const sA = [...new Set(
        suggestions(rA, 99).map((s) => `${transformIdx(t, s.at)}:${s.color}`)
      )].sort();
      const sB = new Set(suggestions(rB, 99).map((s) => `${s.at}:${s.color}`));
      const ok = stabilizer(pB).some((st) => {
        const mapped = sA.map((x) => {
          const [j, c] = x.split(':');
          return `${transformIdx(st, +j)}:${c}`;
        });
        return mapped.length === sB.size && mapped.every((x) => sB.has(x));
      });
      assert.ok(ok, `${br.branch_id} ${t} ply ${i + 1}: suggestion sets differ`);
      checked++;
    }
  }
}

console.log(`symmetry tests: OK (${checked} positions)`);
