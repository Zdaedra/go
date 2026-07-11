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

module.exports = { evalFor };
