// KataGo evaluations for the openings database.
// Every indexed book position was scored offline by KataGo
// (scripts/eval_openings_katago.py); this module looks the current board
// up by its canonical form and maps the engine's best moves back into
// the user's orientation. Winrate/scoreLead are from the side to move.

const db = require('../data/opening_evals.json');
const { canonical, diagramIdxToUser } = require('./symmetry');

/**
 * KataGo evaluation for a live position, or null when the position is
 * not in the evaluated book set.
 * Returns { best: [{ at, winrate, scoreLead }] } in USER orientation,
 * strongest move first.
 */
function evalFor(position, toMove) {
  const { position: canon, transform: userTransform } = canonical(position);
  const perSide = db.positions[canon];
  const rec = perSide && perSide[toMove === 'b' ? 'B' : 'W'];
  if (!rec || !rec.best || !rec.best.length) return null;
  return {
    best: rec.best.map((m) => ({
      at: diagramIdxToUser(m.at, 'identity', userTransform),
      winrate: m.winrate,
      scoreLead: m.scoreLead,
    })),
  };
}

/**
 * Position verdict for the "Оценка" box, independent of whose record we
 * have: returns { blackWinrate, blackLead } (black's perspective, after
 * best play by the side to move), or null when the position is unknown.
 */
function positionEval(position) {
  const { position: canon } = canonical(position);
  const perSide = db.positions[canon];
  if (!perSide) return null;
  for (const side of ['B', 'W']) {
    const rec = perSide[side];
    if (!rec || !rec.best || !rec.best.length) continue;
    const m = rec.best[0]; // winrate/scoreLead from `side`'s perspective
    return side === 'B'
      ? { blackWinrate: m.winrate, blackLead: m.scoreLead }
      : { blackWinrate: 1 - m.winrate, blackLead: -m.scoreLead };
  }
  return null;
}

module.exports = { evalFor, positionEval };
