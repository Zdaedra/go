#!/usr/bin/env node
// Симуляция adaptive2 на реальной базе: синтетические игроки разной силы.
// Проверяет консилиумные фиксы эмпирически:
//   1. НЕТ спирали холодного старта (difficultyMatch пула не вырождается);
//   2. placement сходится к силе игрока (мягкая bisection);
//   3. Elo дрейфует к истинному рейтингу, а не вверх (бинарный Q_rating);
//   4. гейт повторов: <=3 за сессию, не подряд;
//   5. подача держится возле Dtarget.
// Запуск: node scripts/sim_adaptive2.js [seed]

const path = require('path');
const A = require(path.join(__dirname, '..', 'apps', 'mobile', 'src', 'engine', 'adaptive2.js'));
const db = require(path.join(__dirname, '..', 'data', 'tsumego', 'problems.json'));

const pool = db.problems.filter((p) => p.tree && p.tree.length);

// детерминированный PRNG (mulberry32)
function rng(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate(trueR, episodes, seed) {
  const rand = rng(seed);
  const profile = A.newProfile();
  A.startSession(profile);

  const servedD = [];
  let reviewStreak = 0, maxReviewStreak = 0, reviewsInSession = 0, maxReviewsInSession = 0;
  let dmFloorViolations = 0;

  for (let ep = 0; ep < episodes; ep++) {
    if (ep > 0 && ep % 30 === 0) { A.startSession(profile); reviewsInSession = 0; }

    const pick = A.pickNext(profile, pool);
    if (!pick) break;

    const rec = profile.problems[pick.id];
    const isReview = Boolean(rec && rec.wasDueWhenServed);
    if (isReview) {
      reviewStreak += 1; reviewsInSession += 1;
      maxReviewStreak = Math.max(maxReviewStreak, reviewStreak);
      maxReviewsInSession = Math.max(maxReviewsInSession, reviewsInSession);
    } else reviewStreak = 0;

    const D = pick.difficulty;
    if (profile.placement.done && !isReview) {
      servedD.push(D);
      // спираль: лучший difficultyMatch по пулу должен быть достижим
      const Dt = A.dtarget(profile);
      const bestDm = Math.max(...pool.slice(0, 400).map((p) =>
        Math.exp(-((p.difficulty - Dt) ** 2) / (2 * 120 * 120))));
      if (bestDm < 0.005) dmFloorViolations += 1;
    }

    // синтетический игрок
    const pClean = 1 / (1 + Math.pow(10, (D - trueR) / 400));
    const r = rand();
    let outcome;
    if (r < pClean) {
      outcome = { solved: true, weightedWrongCount: 0, hintRung: null };
    } else if (r < pClean + 0.55 * (1 - pClean)) {
      const wwc = rand() < 0.5 ? 1 : 2;
      const rung = rand() < 0.3 ? 1 : null;
      outcome = { solved: true, weightedWrongCount: wwc, hintRung: rung };
    } else if (r < pClean + 0.75 * (1 - pClean)) {
      outcome = { solved: true, weightedWrongCount: 1, hintRung: rand() < 0.5 ? 2 : 3 };
    } else if (rand() < 0.5) {
      outcome = { solved: false, weightedWrongCount: 3, hintRung: null };
    } else {
      outcome = { solved: false, weightedWrongCount: 2, hintRung: 4,
                  sawSolution: true, reproduced: rand() < 0.7 };
    }
    A.recordEpisode(profile, pick, outcome);
  }

  const meanD = servedD.reduce((a, b) => a + b, 0) / Math.max(1, servedD.length);
  return {
    trueR,
    auserAfterPlacement: null, // заполняется ниже отдельным прогоном не нужен
    auserFinal: Math.round(profile.auser),
    ptarget: A.ptargetEff(profile).toFixed(2),
    dtargetFinal: Math.round(A.dtarget(profile)),
    meanServedD: Math.round(meanD),
    maxReviewStreak, maxReviewsInSession,
    dmFloorViolations,
    points: profile.points,
  };
}

// отдельно: куда приходит placement за 8 эпизодов
function placementOnly(trueR, seed) {
  const rand = rng(seed);
  const profile = A.newProfile();
  for (let ep = 0; ep < A.PLACEMENT_EPISODES; ep++) {
    const pick = A.pickNext(profile, pool);
    const D = pick.difficulty;
    const pClean = 1 / (1 + Math.pow(10, (D - trueR) / 400));
    const clean = rand() < pClean;
    A.recordEpisode(profile, pick, clean
      ? { solved: true, weightedWrongCount: 0, hintRung: null }
      : { solved: true, weightedWrongCount: 1, hintRung: null });
  }
  return Math.round(profile.auser);
}

const seed = Number(process.argv[2] || 42);
console.log(`пул: ${pool.length} задач · шкала: p10=${db.problems ? '' : ''}` +
  `${require(path.join(__dirname, '..', 'apps', 'mobile', 'src', 'data', 'scaleMeta.json')).p10}` +
  `..p90=${require(path.join(__dirname, '..', 'apps', 'mobile', 'src', 'data', 'scaleMeta.json')).p90}`);
console.log('\n— placement (8 эпизодов, 5 сидов) —');
for (const R of [1150, 1350, 1500, 1700, 1900]) {
  const lands = [1, 2, 3, 4, 5].map((s) => placementOnly(R, seed + s));
  const mean = Math.round(lands.reduce((a, b) => a + b) / lands.length);
  console.log(`  true=${R}  placement→ ${lands.join(', ')}  (среднее ${mean}, |Δ|=${Math.abs(mean - R)})`);
}
console.log('\n— полный прогон 120 эпизодов —');
console.log('trueR | auser | Ptarget | Dtarget | meanServedD | revStreak | rev/сессию | dmViol | очки');
for (const R of [1150, 1500, 1900]) {
  const s = simulate(R, 120, seed);
  console.log(`${R} | ${s.auserFinal} | ${s.ptarget} | ${s.dtargetFinal} | ${s.meanServedD} | ${s.maxReviewStreak} | ${s.maxReviewsInSession} | ${s.dmFloorViolations} | ${s.points}`);
}
