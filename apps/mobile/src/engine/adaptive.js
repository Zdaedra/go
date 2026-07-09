// Adaptive training engine (lichess-puzzle style): every attempt is a
// match between the user and the problem. User skill is tracked per
// DOMAIN (capture / life / kill / ko / race / connect) with Elo updates;
// the next problem is chosen to keep success probability near the
// "desirable difficulty" zone (~75%), interleaving domains and re-queuing
// mistakes on a spaced schedule.

const START_RATING = 1100;
const TARGET_SUCCESS = 0.75;
const K_NEW = 48;      // fast convergence for the first attempts
const K_STABLE = 24;
const NEW_PHASE = 10;  // attempts per domain before K drops
const REVIEW_AFTER_FAIL = 4;        // items until a failed problem returns
const REVIEW_AFTER_RETRY = 12;      // ... after solving it on a retry
const REVIEW_AFTER_SOLVE = 60;      // rare refresh of solved problems
const MAX_SAME_DOMAIN_STREAK = 2;

/** Fresh training profile. */
function initialProfile() {
  return {
    ratings: {},        // domain -> Elo
    domainAttempts: {}, // domain -> count
    problems: {},       // id -> {tries, fails, solved, dueAt}
    counter: 0,         // items served (spacing clock)
    points: 0,
    solved: 0,
    failed: 0,
    lastDomains: [],    // recent picks, for interleaving
  };
}

function ratingOf(profile, domain) {
  return profile.ratings[domain] ?? START_RATING;
}

/** P(user solves problem) under the Elo model. */
function expectedScore(userRating, problemRating) {
  return 1 / (1 + Math.pow(10, (problemRating - userRating) / 400));
}

/**
 * Record an attempt outcome and update rating/points/schedule.
 * `solved` — the problem ended in 'solved'; `firstTry` — with no wrong
 * moves and no refutations along the way.
 * Returns { ratingDelta, pointsGained, newRating }.
 */
function applyResult(profile, problem, solved, firstTry) {
  const domain = problem.domain || 'ld-live';
  const user = ratingOf(profile, domain);
  const attempts = profile.domainAttempts[domain] ?? 0;
  const K = attempts < NEW_PHASE ? K_NEW : K_STABLE;
  const exp = expectedScore(user, problem.difficulty || START_RATING);
  const score = solved ? 1 : 0;
  const delta = Math.round(K * (score - exp));
  profile.ratings[domain] = user + delta;
  profile.domainAttempts[domain] = attempts + 1;

  const rec = profile.problems[problem.id] ?? { tries: 0, fails: 0, solved: false, dueAt: null };
  rec.tries += 1;
  let pointsGained = 0;
  if (solved) {
    const base = Math.max(1, Math.ceil((problem.difficulty || START_RATING) / 100));
    pointsGained = rec.solved ? 0 : firstTry ? base * 2 : base;
    rec.solved = true;
    rec.dueAt = profile.counter + (firstTry ? REVIEW_AFTER_SOLVE : REVIEW_AFTER_RETRY);
    profile.solved += 1;
  } else {
    rec.fails += 1;
    rec.dueAt = profile.counter + REVIEW_AFTER_FAIL;
    profile.failed += 1;
  }
  profile.problems[problem.id] = rec;
  profile.points += pointsGained;
  return { ratingDelta: delta, pointsGained, newRating: profile.ratings[domain] };
}

function availableDomains(profile, pool) {
  const seen = new Set();
  for (const p of pool) {
    const rec = profile.problems[p.id];
    const unseen = !rec;
    const due = rec && rec.dueAt != null && rec.dueAt <= profile.counter && !(rec.solved && rec.fails === 0);
    if (unseen || due) seen.add(p.domain || 'ld-live');
  }
  return [...seen];
}

/**
 * Choose the next problem from `pool` (marked problems only).
 * Priority: (1) due reviews of past mistakes, (2) weakest domain not
 * repeated more than twice in a row, targeting ~75% success chance.
 * Returns the problem or null when the pool is exhausted.
 */
function pickNext(profile, pool) {
  // 1. Reviews that are due (failed problems come back first).
  const due = pool.filter((p) => {
    const rec = profile.problems[p.id];
    return rec && !rec.solved && rec.dueAt != null && rec.dueAt <= profile.counter;
  });
  if (due.length) {
    due.sort((a, b) => profile.problems[a.id].dueAt - profile.problems[b.id].dueAt);
    profile.counter += 1;
    return due[0];
  }

  // 2. Fresh problem from the most needed domain.
  const unseen = pool.filter((p) => !profile.problems[p.id]);
  if (!unseen.length) {
    // Everything attempted: rotate solved-review queue if anything is due.
    const revisit = pool.filter((p) => {
      const rec = profile.problems[p.id];
      return rec && rec.dueAt != null && rec.dueAt <= profile.counter;
    });
    if (revisit.length) {
      profile.counter += 1;
      return revisit[0];
    }
    return null;
  }

  const domains = [...new Set(unseen.map((p) => p.domain || 'ld-live'))];
  const streakDomain =
    profile.lastDomains.length >= MAX_SAME_DOMAIN_STREAK &&
    profile.lastDomains.slice(-MAX_SAME_DOMAIN_STREAK).every((d) => d === profile.lastDomains[profile.lastDomains.length - 1])
      ? profile.lastDomains[profile.lastDomains.length - 1]
      : null;
  const eligible = domains.filter((d) => d !== streakDomain);
  const pickFrom = eligible.length ? eligible : domains;
  // Weakest rating first => balanced, weakness-focused practice.
  pickFrom.sort((a, b) => ratingOf(profile, a) - ratingOf(profile, b));
  const domain = pickFrom[0];

  const user = ratingOf(profile, domain);
  const candidates = unseen.filter((p) => (p.domain || 'ld-live') === domain);
  candidates.sort(
    (a, b) =>
      Math.abs(expectedScore(user, a.difficulty || START_RATING) - TARGET_SUCCESS) -
      Math.abs(expectedScore(user, b.difficulty || START_RATING) - TARGET_SUCCESS)
  );
  profile.counter += 1;
  profile.lastDomains = [...profile.lastDomains.slice(-4), domain];
  return candidates[0];
}

/** Human level label for a rating (rough kyu/dan feel, in Russian). */
function levelLabel(rating) {
  if (rating < 1000) return 'новичок';
  if (rating < 1250) return 'начинающий';
  if (rating < 1500) return 'уверенный';
  if (rating < 1750) return 'сильный';
  if (rating < 2000) return 'очень сильный';
  return 'мастер';
}

module.exports = {
  START_RATING, TARGET_SUCCESS,
  initialProfile, ratingOf, expectedScore, applyResult, pickNext, levelLabel,
  availableDomains,
};
