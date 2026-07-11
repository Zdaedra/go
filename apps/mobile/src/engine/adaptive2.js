// Adaptive core v2 — ТЗ v3.2: два контура.
//   Контур 1 «Диагностика»: бинарный Q_rating (чистая первая встреча) -> Elo.
//   Контур 2 «Обучение»: градуированный Q_learning -> очки, EWMA-мастерство
//   по доменам (только аналитика), очередь повторов.
// Один рычаг сложности: Dtarget из Auser + ограниченный frustrationTransient.
// Холодный старт: placement-фаза, мягкая bisection (сдвиг границы на 60% к
// середине — одиночный зевок не фатален), границы p10/p90 из scaleMeta.json.
// Заменяет adaptive.js после перевода trainingStats/экранов на новый API.

const scaleMeta = require('../data/scaleMeta.json');

// --- Q ---
const HINT_CAP = [1.0, 0.55, 0.35, 0.15, 0.0]; // H0..H4 (v3.2 §5)

// --- Elo / placement ---
const K_EARLY = 40;
const K_STABLE = 20;
const EARLY_EPISODES = 30;      // rated-эпизодов до снижения K
const PLACEMENT_EPISODES = 8;
const SOFT_STEP = 0.6;          // мягкая граница bisection (правка D)

// --- сложность: один рычаг ---
const P_BASE = 0.72;
const P_MIN = 0.66;
const P_MAX = 0.80;
const FRUST_UP = 0.06;          // 2 из 3 последних Q_learning <= 0.15
const FRUST_DOWN = -0.04;       // 4 из 5 последних Q_learning >= 0.9
const FRUST_DECAY = 0.01;
const SIGMA = 120;              // не тюнить (Д7)

// --- повторы: гейт с лимитом (правка №7 ревью) ---
const REVIEW_AFTER_FAIL = 5;    // эпизодов до возврата провала
const REVIEW_AFTER_RETRY = 12;  // ...решённого не с первой попытки
const MAX_REVIEWS_PER_SESSION = 3;

// --- мастерство доменов (аналитика, НЕ рейтинг) ---
const M_START = 0.6;
const M_ALPHA = 0.3;

function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

// Старт «с самого низа»: новый игрок начинает новичком и растёт вверх, а не
// с середины шкалы (продуктовое решение — не презюмировать силу, вести снизу
// в самый верх). Placement-калибровка при таком старте не нужна — рейтинг
// поднимается обычным Elo по мере решений; Dtarget от низкого Auser сразу
// подбирает простейшие задачи.
const START_RATING = scaleMeta.min;

/** Свежий профиль. Стартует новичком (низ шкалы), placement пропущен. */
function newProfile() {
  return {
    scaleVersion: scaleMeta.scaleVersion,
    auser: START_RATING,
    ratedEpisodes: 0,
    // placement пропущен: done=true с первого эпизода — просто растём вверх.
    placement: { lo: scaleMeta.p10, hi: scaleMeta.p90, step: PLACEMENT_EPISODES, done: true },
    frustration: 0,
    recentQ: [],            // последние Q_learning (окно 5)
    lastDomains: [],        // последние поданные домены (окно 5)
    skillM: {},             // domain -> EWMA мастерства
    points: 0,
    solved: 0,              // эпизоды, решённые самостоятельно
    failed: 0,              // провал / показ решения / пропуск
    counter: 0,             // счётчик поданных эпизодов (часы повторов)
    reviewsServed: 0,       // повторов в текущей сессии
    lastReviewAt: -9,       // counter последнего повтора (гейт "не подряд")
    problems: {},           // id -> состояние
  };
}

/** Начало новой сессии (холодный старт приложения / пауза >= 30 мин). */
function startSession(profile) {
  profile.reviewsServed = 0;
  return profile;
}

// ---------------------------------------------------------------- Q-модель

/**
 * Q_learning: min(база по взвешенным ошибкам, потолок подсказки).
 * outcome: { solved, weightedWrongCount, hintRung (0..4 | null),
 *            sawSolution, reproduced }
 */
function qLearning(outcome) {
  if (!outcome.solved || outcome.sawSolution) return 0;
  const w = outcome.weightedWrongCount || 0;
  const base = w === 0 ? 1.0 : w <= 1.0 ? 0.65 : w <= 2.0 ? 0.35 : 0.10;
  const cap = outcome.hintRung == null ? 1.0 : HINT_CAP[outcome.hintRung];
  // Отдельные H0-шаблоны слегка сужают решение — несут cap 0.9 (§5).
  const h0cap = outcome.h0Cap == null ? 1.0 : outcome.h0Cap;
  return Math.min(base, cap, h0cap);
}

/** Q_rating: чистая первая встреча. H0 (rung 0) чистоту НЕ портит (§5). */
function qRating(outcome, isFirstMeeting) {
  if (!isFirstMeeting) return null; // эпизод не rated
  const cleanHints = outcome.hintRung == null || outcome.hintRung === 0;
  return outcome.solved && !outcome.sawSolution && cleanHints &&
    (outcome.weightedWrongCount || 0) === 0 ? 1 : 0;
}

// ---------------------------------------------------------------- эпизод

/**
 * Записать завершённый эпизод. Возвращает
 * { qR, qL, ratingDelta, pointsGained, auser }.
 */
function recordEpisode(profile, problem, outcome) {
  const D = problem.difficulty || scaleMeta.median;
  const rec = profile.problems[problem.id] ||
    (profile.problems[problem.id] = {
      firstMeetingDone: false, tries: 0, solved: false,
      hintRungMax: null, seenSolution: false, dueEpisode: null,
    });
  const isFirst = !rec.firstMeetingDone;
  const qL = qLearning(outcome);
  const qR = qRating(outcome, isFirst);

  // --- контур 1: рейтинг (только первая встреча) ---
  let ratingDelta = 0;
  if (isFirst) {
    rec.firstMeetingDone = true;
    rec.qRating = qR;
    if (!profile.placement.done) {
      const pl = profile.placement;
      const mid = (pl.lo + pl.hi) / 2;
      if (qR === 1) pl.lo += SOFT_STEP * (mid - pl.lo);
      else pl.hi -= SOFT_STEP * (pl.hi - mid);
      pl.step += 1;
      profile.auser = (pl.lo + pl.hi) / 2;
      if (pl.step >= PLACEMENT_EPISODES) pl.done = true;
    } else {
      const K = profile.ratedEpisodes < EARLY_EPISODES ? K_EARLY : K_STABLE;
      const E = 1 / (1 + Math.pow(10, (D - profile.auser) / 400));
      ratingDelta = Math.round(K * (qR - E));
      profile.auser += ratingDelta;
    }
    profile.ratedEpisodes += 1;
  }

  // --- контур 2: обучение ---
  rec.tries += 1;
  rec.solved = rec.solved || outcome.solved;
  rec.seenSolution = rec.seenSolution || Boolean(outcome.sawSolution);
  if (outcome.hintRung != null) {
    rec.hintRungMax = rec.hintRungMax == null
      ? outcome.hintRung : Math.max(rec.hintRungMax, outcome.hintRung);
  }
  const domain = problem.domain || 'ld-live';
  const m = profile.skillM[domain] ?? M_START;
  profile.skillM[domain] = M_ALPHA * qL + (1 - M_ALPHA) * m;

  // frustration transient: единственная динамика поверх Auser
  profile.recentQ = [...profile.recentQ.slice(-4), qL];
  const last3 = profile.recentQ.slice(-3);
  const last5 = profile.recentQ.slice(-5);
  if (last3.filter((q) => q <= 0.15).length >= 2) {
    profile.frustration = FRUST_UP;
  } else if (last5.length >= 5 && last5.filter((q) => q >= 0.9).length >= 4) {
    profile.frustration = FRUST_DOWN;
  } else if (profile.frustration > 0) {
    profile.frustration = Math.max(0, profile.frustration - FRUST_DECAY);
  } else if (profile.frustration < 0) {
    profile.frustration = Math.min(0, profile.frustration + FRUST_DECAY);
  }

  // повторы (v1 — внутрисессионные, по счётчику эпизодов)
  if (!outcome.solved || outcome.sawSolution) {
    rec.dueEpisode = profile.counter + REVIEW_AFTER_FAIL;
  } else if (rec.tries > 1 || (outcome.weightedWrongCount || 0) > 0) {
    rec.dueEpisode = profile.counter + REVIEW_AFTER_RETRY;
  } else {
    rec.dueEpisode = null; // чистое решение: межсессионный повтор — фаза 2
  }

  // --- очки (§8): отдельная сущность ---
  const base = Math.max(1, Math.ceil(D / 100));
  let pointsGained = 0;
  const isDueReview = !isFirst && rec.wasDueWhenServed;
  if (isFirst) {
    pointsGained = Math.round(base * qL) * (qR === 1 ? 2 : 1);
  } else if (isDueReview) {
    pointsGained = Math.round(base * qL); // повтор по сроку: без x2
  } // повторное решение вне срока: 0 (анти-фарм)
  if (outcome.reproduced && rec.seenSolution) {
    pointsGained += Math.round(0.2 * base); // воспроизведение после разбора
  }
  rec.wasDueWhenServed = false;
  profile.points += pointsGained;
  if (outcome.solved) profile.solved += 1;
  else profile.failed += 1;

  return { qR, qL, ratingDelta, pointsGained, auser: Math.round(profile.auser) };
}

// ---------------------------------------------------------------- подбор

function ptargetEff(profile) {
  return clamp(P_BASE + profile.frustration, P_MIN, P_MAX);
}

function dtarget(profile) {
  const p = ptargetEff(profile);
  return profile.auser + 400 * Math.log10((1 - p) / p);
}

/**
 * Подать следующую задачу. pool — задачи с деревом. null = пул исчерпан.
 * domainFilter (опц.) — игрок сам выбрал область на радаре/в прогрессе:
 * подаём только задачи этого домена, но по той же логике уровня (Dtarget)
 * и с той же записью в профиль — это донатит в общую систему обучения.
 */
function pickNext(profile, pool, domainFilter = null) {
  profile.counter += 1;
  if (domainFilter) {
    pool = pool.filter((p) => (p.domain || 'ld-live') === domainFilter);
  }

  // -- placement: bisection мимо utility --
  if (!profile.placement.done) {
    const mid = (profile.placement.lo + profile.placement.hi) / 2;
    const unseen = pool.filter((p) => !profile.problems[p.id]?.firstMeetingDone);
    if (!unseen.length) return null;
    const lastDom = profile.lastDomains[profile.lastDomains.length - 1];
    unseen.sort((a, b) => {
      const da = Math.abs((a.difficulty || 0) - mid);
      const db = Math.abs((b.difficulty || 0) - mid);
      if (da !== db) return da - db;
      // при равных — другой домен, чем предыдущий
      return (a.domain === lastDom ? 1 : 0) - (b.domain === lastDom ? 1 : 0);
    });
    const pick = unseen[0];
    profile.lastDomains = [...profile.lastDomains.slice(-4), pick.domain];
    return pick;
  }

  // -- гейт повторов: до MAX_REVIEWS_PER_SESSION за сессию, не подряд --
  if (profile.reviewsServed < MAX_REVIEWS_PER_SESSION &&
      profile.lastReviewAt !== profile.counter - 1) {
    const due = pool.filter((p) => {
      const r = profile.problems[p.id];
      return r && r.dueEpisode != null && r.dueEpisode <= profile.counter;
    });
    if (due.length) {
      due.sort((a, b) =>
        profile.problems[a.id].dueEpisode - profile.problems[b.id].dueEpisode);
      const pick = due[0];
      const rec = profile.problems[pick.id];
      rec.dueEpisode = null;
      rec.wasDueWhenServed = true;
      profile.reviewsServed += 1;
      profile.lastReviewAt = profile.counter;
      profile.lastDomains = [...profile.lastDomains.slice(-4), pick.domain];
      return pick;
    }
  }

  // -- utility по невиданным --
  const Dt = dtarget(profile);
  const unseen = pool.filter((p) => !profile.problems[p.id]?.firstMeetingDone);
  if (!unseen.length) return null;

  const sessionCount = {};
  for (const d of profile.lastDomains) {
    sessionCount[d] = (sessionCount[d] || 0) + 1;
  }
  const prev = profile.lastDomains.slice(-2);

  let best = null;
  let bestU = -Infinity;
  for (const p of unseen) {
    const D = p.difficulty || scaleMeta.median;
    const domain = p.domain || 'ld-live';
    const difficultyMatch = Math.exp(-((D - Dt) ** 2) / (2 * SIGMA * SIGMA));
    const skillNeed = clamp(1 - (profile.skillM[domain] ?? M_START), 0, 1);
    const recent = profile.lastDomains.filter((d) => d === domain).length;
    const novelty = clamp(1 - recent / 5, 0, 1);
    const share = (sessionCount[domain] || 0) / Math.max(1, profile.lastDomains.length);
    const sessionBalance = clamp(1 - share, 0, 1);
    const repetitionPenalty =
      prev.length === 2 && prev.every((d) => d === domain) ? 0.3 : 0;
    const u = 0.45 * difficultyMatch + 0.30 * skillNeed +
      0.15 * novelty + 0.10 * sessionBalance - repetitionPenalty;
    if (u > bestU) { bestU = u; best = p; }
  }
  if (best) {
    profile.lastDomains = [...profile.lastDomains.slice(-4), best.domain];
  }
  return best;
}

// ---------------------------------------------------------------- метки

/** Относительная метка сложности (i18n-ключ rel_*). */
function relativeLabel(profile, problem) {
  const d = (problem.difficulty || scaleMeta.median) - profile.auser;
  if (d <= -250) return 'rel_warmup';
  if (d <= -100) return 'rel_comfy';
  if (d <= 100) return 'rel_right';
  if (d <= 250) return 'rel_hard';
  return 'rel_challenge';
}

/** Уровень игрока по Auser (i18n-ключ level_*; шкала v2, медиана 1500). */
function levelLabel(rating) {
  if (rating < 1250) return 'level_novice';
  if (rating < 1400) return 'level_beginner';
  if (rating < 1550) return 'level_confident';
  if (rating < 1750) return 'level_strong';
  if (rating < 1950) return 'level_very_strong';
  return 'level_master';
}

const DEFAULT_RATING = START_RATING;

module.exports = {
  newProfile, startSession, recordEpisode, pickNext,
  qLearning, qRating, ptargetEff, dtarget, relativeLabel, levelLabel,
  HINT_CAP, PLACEMENT_EPISODES, MAX_REVIEWS_PER_SESSION, DEFAULT_RATING,
  START_RATING, scaleMeta,
};
