// The 8 board symmetries, matching scripts/build_branch_tree.py.
// Canonicalization lets the app recognize an opening no matter how the
// user's board is rotated or mirrored relative to the book diagrams.

const { SIZE } = require('./board');

const N = SIZE - 1;

const TRANSFORMS = {
  identity: (c, r) => [c, r],
  rot90: (c, r) => [N - r, c],
  rot180: (c, r) => [N - c, N - r],
  rot270: (c, r) => [r, N - c],
  flip_h: (c, r) => [N - c, r],
  flip_v: (c, r) => [c, N - r],
  transpose: (c, r) => [r, c],
  anti_transpose: (c, r) => [N - r, N - c],
};

const INVERSE = {
  identity: 'identity',
  rot90: 'rot270',
  rot180: 'rot180',
  rot270: 'rot90',
  flip_h: 'flip_h',
  flip_v: 'flip_v',
  transpose: 'transpose',
  anti_transpose: 'anti_transpose',
};

function transformIdx(name, i) {
  const c = i % SIZE, r = Math.floor(i / SIZE);
  const [tc, tr] = TRANSFORMS[name](c, r);
  return tr * SIZE + tc;
}

function transformPosition(pos, name) {
  if (name === 'identity') return pos;
  const out = new Array(SIZE * SIZE).fill('.');
  for (let i = 0; i < pos.length; i++) {
    if (pos[i] !== '.') out[transformIdx(name, i)] = pos[i];
  }
  return out.join('');
}

/** Transforms that leave a position unchanged (its symmetry group).
 * Always includes 'identity'. A single centre stone returns all 8. */
function stabilizer(pos) {
  return Object.keys(TRANSFORMS).filter((t) => transformPosition(pos, t) === pos);
}

/** All distinct board indices symmetric to `i` under a position's stabilizer. */
function orbit(i, stab) {
  const seen = new Set();
  for (const t of stab) seen.add(transformIdx(t, i));
  return [...seen];
}

/** Smallest position string over all 8 symmetries. */
function canonical(pos) {
  let best = pos, bestName = 'identity';
  for (const name of Object.keys(TRANSFORMS)) {
    if (name === 'identity') continue;
    const t = transformPosition(pos, name);
    if (t < best) { best = t; bestName = name; }
  }
  return { position: best, transform: bestName };
}

/**
 * Map a board index from DIAGRAM orientation to USER orientation.
 * `toCanonical` is the diagram entry's transform (diagram -> canonical),
 * `userTransform` is the transform that canonicalized the user's board
 * (user -> canonical). diagram -> canonical -> user.
 */
function diagramIdxToUser(i, toCanonical, userTransform) {
  return transformIdx(INVERSE[userTransform], transformIdx(toCanonical, i));
}

module.exports = {
  TRANSFORMS, INVERSE,
  transformIdx, transformPosition, canonical, diagramIdxToUser,
  stabilizer, orbit,
};
