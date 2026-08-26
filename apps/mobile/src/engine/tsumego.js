// Tsumego solving session: walks the problem's solution tree as the user
// plays. The opponent auto-replies with the tree's first answer.
// Problems may live on any board size (problem.size, default 9); problems
// without a solution tree run in free-solve mode: the user plays both
// sides and self-marks the result.

const { play, sgfToIdx } = require('./board');

const sizeOfProblem = (problem) => problem.size || 9;

const hasSolution = (problem) => (problem.tree || []).length > 0;

/** Start a session for a problem from tsumego.json. */
function startSession(problem) {
  return {
    problem,
    size: sizeOfProblem(problem),
    board: problem.board,
    nodes: problem.tree || [],
    toMove: problem.to_move,
    free: !hasSolution(problem),
    status: 'playing', // 'playing' | 'solved' | 'refuted' | 'wrong'
    moves: [],
    // Лог отклонённых тапов (ТЗ v3.2 §6, Д4): каждый off-tree тап пишется
    // событием с весом. weightedWrongCount(session) суммирует.
    wrongLog: [],
  };
}

/** Вес ошибочного тапа (Д4/Д5): повтор пункта на той же позиции — 0;
 * вне view-окна или на глубоком узле (после >=1 своего верного хода) — 0.5;
 * правдоподобный корневой промах — 1. */
function wrongTapWeight(session, at) {
  const ply = session.moves.length;
  if ((session.wrongLog || []).some((e) => e.at === at && e.ply === ply)) {
    return 0;
  }
  const size = session.size;
  const v = session.problem.view;
  const c = at % size;
  const r = Math.floor(at / size);
  const outside = v ? (c < v.c0 || c > v.c1 || r < v.r0 || r > v.r1) : false;
  const userMovesPlayed = session.moves.filter(
    (m) => m.by === session.problem.to_move
  ).length;
  return outside || userMovesPlayed >= 1 ? 0.5 : 1;
}

/** Сумма весов ошибок за эпизод — вход для Q_learning/Q_rating. */
function weightedWrongCount(session) {
  return (session.wrongLog || []).reduce((a, e) => a + e.w, 0);
}

/**
 * The user plays at `at` (board index).
 * Tree mode statuses: 'wrong' (off-tree, board unchanged), 'refuted'
 * (known mistake played out), 'solved', 'playing' (opponent replied).
 * Free mode: both sides alternate, every legal move keeps 'playing'.
 */
function playUserMove(session, at) {
  if (session.status !== 'playing') return session;
  const size = session.size;

  if (session.free) {
    const res = play(session.board, at, session.toMove);
    if (!res) return session; // occupied/suicide: ignore tap
    return {
      ...session,
      board: res.board,
      toMove: session.toMove === 'b' ? 'w' : 'b',
      moves: [...session.moves, { at, by: session.toMove }],
    };
  }

  const node = (session.nodes || []).find(
    (n) => sgfToIdx(n.at, size) === at && n.by === session.toMove
  );
  if (!node) {
    // Off-tree: physically place the stone so the tap feels real, remember
    // the previous board — clearWrong() lifts the stone back off.
    const w = wrongTapWeight(session, at);
    const wrongLog = [
      ...(session.wrongLog || []),
      { at, ply: session.moves.length, w },
    ];
    const tryRes = play(session.board, at, session.toMove);
    if (!tryRes) return { ...session, status: 'wrong', wrongLog };
    return {
      ...session,
      status: 'wrong',
      board: tryRes.board,
      prevBoard: session.board,
      wrongAt: at,
      wrongLog,
    };
  }
  let board = session.board;
  const res = play(board, at, node.by);
  if (!res) return { ...session, status: 'wrong' };
  board = res.board;
  const moves = [...session.moves, { at, by: node.by }];

  if (node.tag === 'wrong') {
    // Play out the refutation line (first children chain), then fail.
    // Правдоподобный неверный ход (decoy) — засчитанная ошибка веса 1 (§6).
    const wrongLog = [
      ...(session.wrongLog || []),
      { at, ply: session.moves.length, w: 1 },
    ];
    let cur = node;
    while (cur.children && cur.children.length) {
      cur = cur.children[0];
      const r = play(board, sgfToIdx(cur.at, size), cur.by);
      if (!r) break;
      board = r.board;
      moves.push({ at: sgfToIdx(cur.at, size), by: cur.by });
    }
    return { ...session, board, moves, status: 'refuted', wrongLog };
  }

  const children = node.children || [];
  if (children.length === 0) {
    // Correct or untagged leaf: solved.
    return { ...session, board, moves, status: 'solved' };
  }
  // Opponent replies with the first answer in the tree.
  const reply = children[0];
  const r2 = play(board, sgfToIdx(reply.at, size), reply.by);
  if (!r2) {
    // Broken tree data: the book's own reply is illegal here. Never award
    // a silent win — it masks marking bugs (scripts/audit_tsumego_tree.py
    // guards this invariant offline). Loud in dev, generous-but-logged in
    // production so the player isn't punished for our data.
    console.error('[tsumego] illegal opponent reply in solution tree', {
      problem: session.problem && session.problem.id, at: reply.at, by: reply.by,
    });
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      throw new Error(
        `broken tsumego tree: illegal reply ${reply.at} in ${session.problem && session.problem.id}`
      );
    }
    return { ...session, board, moves, status: 'solved' };
  }
  moves.push({ at: sgfToIdx(reply.at, size), by: reply.by });
  return {
    ...session,
    board: r2.board,
    moves,
    nodes: reply.children || [],
    status: (reply.children || []).length ? 'playing' : 'solved',
  };
}

/** Undo the user's + opponent's last moves in free mode. */
function undoFreeMove(session) {
  if (!session.free || session.moves.length === 0) return session;
  // Rebuild from scratch (boards are small; correctness over speed).
  let s = startSession(session.problem);
  for (const mv of session.moves.slice(0, -1)) {
    s = playUserMove(s, mv.at);
  }
  return s;
}

/** Clear a transient 'wrong' status back to playing (lifts the stone). */
function clearWrong(session) {
  if (session.status !== 'wrong') return session;
  return {
    ...session,
    status: 'playing',
    board: session.prevBoard ?? session.board,
    prevBoard: undefined,
    wrongAt: undefined,
  };
}

/** Board index of the first correct move (for the hint ghost). */
function hintMove(problem) {
  const tree = problem.tree || [];
  const good = tree.find((n) => n.tag === 'correct' || n.children) || tree[0];
  return good ? sgfToIdx(good.at, sizeOfProblem(problem)) : null;
}

// ---- Лестница подсказок (ТЗ v3.2 §5): работает по ТЕКУЩЕМУ узлу сессии ----

/** H4: верный ход из текущей позиции (не только корня — чинит G5). */
function hintMoveAt(session) {
  const nodes = session.nodes || [];
  const good =
    nodes.find((n) => n.by === session.toMove && n.tag !== 'wrong') || null;
  return good ? sgfToIdx(good.at, session.size) : null;
}

/** H1: структурный объект — «на что смотреть» (поля из build_structural_targets).
 * null => деградация в доменный шаблон (hintTemplates.h1Fallback). */
function hintStructure(problem) {
  if (!problem.h1Zone || !problem.structuralTargets) return null;
  return { zone: problem.h1Zone, targets: problem.structuralTargets };
}

/** H3: кандидаты — ТОЛЬКО корневой узел (Д3: глубже альтернатив в данных
 * нет). Нужно >=2 правдоподобных decoy, иначе null => деградация в
 * направляющий вопрос. Порядок стабильный: перемешивает UI. */
function hintCandidates(session) {
  if (session.moves.length > 0) return null; // не корень
  const size = session.size;
  const roots = session.nodes || [];
  const correct = roots.filter((n) => n.tag !== 'wrong');
  const decoys = roots.filter((n) => n.tag === 'wrong');
  if (!correct.length || decoys.length < 2) return null;
  return {
    correctAts: correct.map((n) => sgfToIdx(n.at, size)),
    decoyAts: decoys.slice(0, 2).map((n) => sgfToIdx(n.at, size)),
  };
}

/** View rectangle {c0,r0,c1,r1} covering the action with a margin. */
function viewRect(problem, margin = 2) {
  const size = sizeOfProblem(problem);
  if (problem.view) return problem.view;
  const pts = [];
  for (let i = 0; i < problem.board.length; i++) {
    if (problem.board[i] !== '.') pts.push(i);
  }
  const addTree = (nodes) => {
    for (const n of nodes || []) {
      pts.push(sgfToIdx(n.at, size));
      addTree(n.children);
    }
  };
  addTree(problem.tree);
  if (!pts.length) return { c0: 0, r0: 0, c1: size - 1, r1: size - 1 };
  const cols = pts.map((i) => i % size);
  const rows = pts.map((i) => Math.floor(i / size));
  return {
    c0: Math.max(0, Math.min(...cols) - margin),
    r0: Math.max(0, Math.min(...rows) - margin),
    c1: Math.min(size - 1, Math.max(...cols) + margin),
    r1: Math.min(size - 1, Math.max(...rows) + margin),
  };
}

module.exports = {
  startSession, playUserMove, undoFreeMove, clearWrong, hintMove,
  hasSolution, viewRect,
  wrongTapWeight, weightedWrongCount, hintMoveAt, hintStructure, hintCandidates,
};
