// Node tests for the adaptive training engine.
// Run from apps/mobile:  node test/adaptive.test.cjs

const assert = require('node:assert/strict');
const {
  initialProfile, ratingOf, expectedScore, applyResult, pickNext, levelLabel,
} = require('../src/engine/adaptive');
const db = require('../src/data/tsumego.json');

const pool = db.problems.filter((p) => p.tree && p.tree.length > 0);
assert.ok(pool.length >= 30, 'marked pool present');
assert.ok(pool.every((p) => p.difficulty && p.domain), 'annotations present');

// Ratings rise on solve, fall on fail; points only for solving.
{
  const profile = initialProfile();
  const p = pool[0];
  const before = ratingOf(profile, p.domain);
  const win = applyResult(profile, p, true, true);
  assert.ok(win.ratingDelta > 0, 'rating up after solve');
  assert.ok(win.pointsGained > 0, 'points for a solve');
  const q = pool.find((x) => x.domain === p.domain && x.id !== p.id) || pool[1];
  const loss = applyResult(profile, q, false, false);
  assert.ok(loss.ratingDelta < 0, 'rating down after fail');
  assert.equal(loss.pointsGained, 0, 'no points for a fail');
  assert.ok(ratingOf(profile, p.domain) !== before);
}

// Staircase: after failures the trainer serves easier problems.
{
  const profile = initialProfile();
  let last = pickNext(profile, pool);
  const firstDifficulty = last.difficulty;
  // Fail five in a row => rating drops => picks trend easier.
  for (let i = 0; i < 5; i++) {
    applyResult(profile, last, false, false);
    const next = pickNext(profile, pool);
    assert.ok(next, 'pool not exhausted');
    last = next;
  }
  assert.ok(
    last.difficulty <= firstDifficulty,
    `difficulty stepped down (${firstDifficulty} -> ${last.difficulty})`
  );
}

// Interleaving: no domain repeats more than twice in a row (when others exist).
{
  const profile = initialProfile();
  const picks = [];
  for (let i = 0; i < 12; i++) {
    const p = pickNext(profile, pool);
    if (!p) break;
    picks.push(p.domain);
    applyResult(profile, p, true, true);
  }
  for (let i = 2; i < picks.length; i++) {
    const same = picks[i] === picks[i - 1] && picks[i] === picks[i - 2];
    assert.ok(!same, `domain ${picks[i]} served 3x in a row at ${i}`);
  }
}

// Spaced repetition: a failed problem comes back after a few others.
{
  const profile = initialProfile();
  const first = pickNext(profile, pool);
  applyResult(profile, first, false, false);
  const seen = [];
  let cameBack = false;
  for (let i = 0; i < 8; i++) {
    const p = pickNext(profile, pool);
    if (!p) break;
    seen.push(p.id);
    if (p.id === first.id) { cameBack = true; break; }
    applyResult(profile, p, true, true);
  }
  assert.ok(cameBack, `failed problem re-queued (saw: ${seen.join(', ')})`);
}

// Expected score is sane and level labels cover the range.
{
  assert.ok(expectedScore(1500, 1500) === 0.5);
  assert.ok(expectedScore(1700, 1500) > 0.7);
  assert.equal(typeof levelLabel(900), 'string');
  assert.equal(typeof levelLabel(2100), 'string');
}

console.log('adaptive tests: OK');
