// Opening/branch identification against the openings database.
// Feed it the current board position after every move; it answers which
// openings/branches the position belongs to, whose move it is, what the
// database suggests next, and which continuation letters/triangles to
// draw — all mapped into the user's board orientation.

const db = require('../data/branches.json');
const { sgfToIdx } = require('./board');
const { canonical, diagramIdxToUser } = require('./symmetry');

const branchById = new Map(db.branches.map((b) => [b.branch_id, b]));

function getBranch(branchId) {
  return branchById.get(branchId);
}

function allBranches() {
  return db.branches;
}

/**
 * Identify a position (81-char string).
 * Returns {
 *   status: 'empty' | 'unknown' | 'candidates' | 'identified',
 *   matches: [{ branch, ply, final, mapIdx(diagramIdx) -> userIdx }],
 *   openings: [{ family, opening, name }],   // distinct, best match first
 *   opening: ... | null,                     // when status === 'identified'
 * }
 */
function identify(position) {
  if (!position.includes('b') && !position.includes('w')) {
    return { status: 'empty', matches: [], openings: [], opening: null };
  }
  const { position: canon, transform: userTransform } = canonical(position);
  const entries = db.position_index[canon] || [];
  const matches = entries
    .map((e) => {
      const branch = branchById.get(e.branch_id);
      if (!branch) return null;
      const toCanonical = e.to_canonical;
      return {
        branch,
        ply: e.ply,
        final: e.final,
        mapIdx: (i) => diagramIdxToUser(i, toCanonical, userTransform),
      };
    })
    .filter(Boolean)
    // Prefer real openings over chapter preambles, earlier branches first.
    .sort((a, b) => {
      const pre = (m) => (m.branch.opening === 'preamble' ? 1 : 0);
      return pre(a) - pre(b) || a.branch.branch_no - b.branch.branch_no;
    });

  const seen = new Set();
  const openings = [];
  for (const m of matches) {
    const key = m.branch.family + '/' + m.branch.opening;
    if (m.branch.opening === 'preamble' || seen.has(key)) continue;
    seen.add(key);
    openings.push({
      family: m.branch.family,
      opening: m.branch.opening,
      name: m.branch.opening_name,
    });
  }

  if (matches.length === 0) {
    return { status: 'unknown', matches: [], openings: [], opening: null };
  }
  return {
    status: openings.length === 1 ? 'identified' : 'candidates',
    matches,
    openings,
    opening: openings.length === 1 ? openings[0] : null,
  };
}

/**
 * Suggested next moves for the current matches, in USER orientation.
 * Up to `limit` distinct points: the next database move of each matched
 * branch, then continuation letters of final positions.
 * Returns [{ at, color, label }] where `at` is a user-board index.
 */
function suggestions(result, limit = 3) {
  const out = new Map();
  for (const m of result.matches) {
    if (out.size >= limit) break;
    const next = m.branch.moves[m.ply];
    if (!next) continue;
    const at = m.mapIdx(sgfToIdx(next.coord));
    if (!out.has(at)) out.set(at, { at, color: next.color, label: null });
  }
  for (const m of result.matches) {
    if (out.size >= limit) break;
    if (!m.final) continue;
    for (const c of m.branch.continuations) {
      if (out.size >= limit) break;
      if (c.on !== 'empty') continue;
      const at = m.mapIdx(sgfToIdx(c.coord));
      if (!out.has(at)) out.set(at, { at, color: c.by, label: c.label });
    }
  }
  return [...out.values()];
}

/**
 * Continuation letters/triangles to draw when a matched diagram is at its
 * final position, in USER orientation.
 * Returns [{ at, label, kind, by, next }].
 */
function continuationMarks(result) {
  const out = new Map();
  for (const m of result.matches) {
    if (!m.final) continue;
    for (const c of m.branch.continuations) {
      if (c.on !== 'empty') continue;
      const at = m.mapIdx(sgfToIdx(c.coord));
      if (!out.has(at)) {
        out.set(at, { at, label: c.label, kind: c.kind, by: c.by, next: c.next });
      }
    }
  }
  return [...out.values()];
}

/** Best identified branch (deepest non-preamble match), or null. */
function currentBranch(result) {
  const real = result.matches.filter((m) => m.branch.opening !== 'preamble');
  if (!real.length) return null;
  let best = real[0];
  for (const m of real) if (m.ply > best.ply) best = m;
  return best;
}

module.exports = { getBranch, allBranches, identify, suggestions, continuationMarks, currentBranch };
