// Node tests for the adaptive training engine (v2 — two-loop core).
// Run from apps/mobile:  node test/adaptive.test.cjs
//
// The engine is engine/adaptive2.js: a diagnostic loop (binary Q_rating on the
// clean first meeting -> Elo) and a learning loop (graded Q_learning -> points,
// EWMA mastery, spaced review). A fresh profile starts a novice at the bottom
// of the scale with placement skipped, so ratings climb with clean solves and
// fall with fails. Outcome shape mirrors EpisodeOutcome in state/trainingStats.

const assert = require('node:assert/strict');
const {
  newProfile, recordEpisode, pickNext, abilityFor,
  relativeLabel, levelLabel, dtarget, START_RATING,
  SRS_INTERVALS_DAYS, scaleMeta,
} = require('../src/engine/adaptive2');
const db = require('../src/data/tsumego.json');

const pool = db.problems.filter((p) => p.tree && p.tree.length > 0);
assert.ok(pool.length >= 30, 'marked pool present');
assert.ok(pool.every((p) => p.difficulty && p.domain), 'annotations present');

const solveClean = () => ({ solved: true, weightedWrongCount: 0, hintRung: null });
const fail = () => ({ solved: false, weightedWrongCount: 0, hintRung: null });

// Ratings rise on a clean solve, fall on a fail; points only for solving.
{
  const profile = newProfile();
  const p = pool[0];
  const before = abilityFor(profile, p.domain);
  const win = recordEpisode(profile, p, solveClean());
  assert.equal(win.qR, 1, 'clean first meeting is a rated win');
  assert.ok(win.ratingDelta > 0, 'rating up after solve');
  assert.ok(win.pointsGained > 0, 'points for a solve');
  // Read ability right after the win: the domain offset drifts on every rated
  // episode, so a later fail would pull it back down.
  assert.ok(abilityFor(profile, p.domain) > before, 'ability rose after solve');

  // A different, easy problem in the same domain, failed on first meeting.
  const q = pool
    .filter((x) => x.domain === p.domain && x.id !== p.id)
    .sort((a, b) => a.difficulty - b.difficulty)[0];
  const beforeFail = profile.auser;
  const loss = recordEpisode(profile, q, fail());
  assert.equal(loss.qR, 0, 'a fail is not a rated win');
  assert.ok(loss.ratingDelta < 0, 'rating down after fail');
  assert.equal(loss.pointsGained, 0, 'no points for a fail');
  assert.ok(profile.auser < beforeFail, 'rating dropped after fail');
}

// Elo expectation: solving a harder problem earns more than an easy one.
{
  const a = newProfile();
  const gainEasy = recordEpisode(
    a, { id: 'syn-easy', difficulty: a.auser - 200, domain: 'ld-live' }, solveClean(),
  ).ratingDelta;
  const b = newProfile();
  const gainHard = recordEpisode(
    b, { id: 'syn-hard', difficulty: b.auser + 200, domain: 'ld-live' }, solveClean(),
  ).ratingDelta;
  assert.ok(gainHard > gainEasy, `harder solve earns more (${gainEasy} vs ${gainHard})`);
}

// Staircase: repeated failures lower the rating and the difficulty target, so
// the trainer trends toward easier problems.
{
  const profile = newProfile();
  let last = pickNext(profile, pool);
  assert.ok(last, 'first pick');
  const dtBefore = dtarget(profile);
  for (let i = 0; i < 5; i++) {
    recordEpisode(profile, last, fail());
    last = pickNext(profile, pool);
    assert.ok(last, 'pool not exhausted');
  }
  assert.ok(profile.auser < START_RATING, 'rating fell after five failures');
  assert.ok(dtarget(profile) < dtBefore, 'difficulty target stepped down');
}

// The lever runs both ways: a stronger profile is served harder problems.
{
  const easy = newProfile();
  const easyPick = pickNext(easy, pool);
  const strong = newProfile();
  for (let i = 0; i < 25; i++) {
    const p = pickNext(strong, pool);
    if (!p) break;
    recordEpisode(strong, p, solveClean());
  }
  const strongPick = pickNext(strong, pool);
  assert.ok(strong.auser > easy.auser, 'ability climbed with clean solves');
  assert.ok(
    strongPick.difficulty > easyPick.difficulty,
    `stronger player served harder (${easyPick.difficulty} -> ${strongPick.difficulty})`,
  );
}

// Interleaving: no domain is served three times in a row (when others exist).
{
  const profile = newProfile();
  const picks = [];
  for (let i = 0; i < 12; i++) {
    const p = pickNext(profile, pool);
    if (!p) break;
    picks.push(p.domain);
    recordEpisode(profile, p, solveClean());
  }
  assert.ok(new Set(picks).size >= 2, 'more than one domain served');
  for (let i = 2; i < picks.length; i++) {
    const same = picks[i] === picks[i - 1] && picks[i] === picks[i - 2];
    assert.ok(!same, `domain ${picks[i]} served 3x in a row at ${i}`);
  }
}

// Within-session review: a failed problem is re-queued after a few others.
{
  const profile = newProfile();
  const first = pickNext(profile, pool);
  recordEpisode(profile, first, fail());
  const seen = [];
  let cameBack = false;
  for (let i = 0; i < 8; i++) {
    const p = pickNext(profile, pool);
    if (!p) break;
    seen.push(p.id);
    if (p.id === first.id) { cameBack = true; break; }
    recordEpisode(profile, p, solveClean());
  }
  assert.ok(cameBack, `failed problem re-queued (saw: ${seen.join(', ')})`);
}

// Cross-session SRS: a clean solve schedules the next review by real date, and
// reviewOnly resurfaces it only once that interval has elapsed.
{
  const profile = newProfile();
  const DAY = 24 * 60 * 60 * 1000;
  const t0 = 1_000_000_000_000; // fixed epoch; the engine forbids Date.now here
  const p = pickNext(profile, pool, null, t0);
  recordEpisode(profile, p, solveClean(), t0);
  const rec = profile.problems[p.id];
  assert.equal(rec.dueDate, t0 + SRS_INTERVALS_DAYS[0] * DAY, 'due one interval out');
  assert.equal(rec.srsLevel, 1, 'srs level advanced after a clean solve');
  assert.equal(
    pickNext(profile, pool, null, t0 + 0.5 * DAY, true), null,
    'nothing due before the interval elapses',
  );
  const due = pickNext(profile, pool, null, rec.dueDate + DAY, true);
  assert.ok(due && due.id === p.id, 'problem resurfaces once its interval elapses');
}

// Labels span the scale, and relative difficulty keys off player ability.
{
  assert.equal(typeof levelLabel(scaleMeta.min), 'string');
  assert.equal(typeof levelLabel(scaleMeta.max), 'string');
  assert.notEqual(
    levelLabel(scaleMeta.min), levelLabel(scaleMeta.max),
    'labels differ across the range',
  );
  const profile = newProfile();
  assert.equal(
    relativeLabel(profile, { difficulty: profile.auser - 400, domain: 'ld-live' }),
    'rel_warmup',
  );
  assert.equal(
    relativeLabel(profile, { difficulty: profile.auser + 400, domain: 'ld-live' }),
    'rel_challenge',
  );
  assert.match(
    relativeLabel(profile, { difficulty: profile.auser, domain: 'ld-live' }), /^rel_/,
  );
}

console.log('adaptive tests: OK');
