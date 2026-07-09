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
  };
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
    return { ...session, status: 'wrong' };
  }
  let board = session.board;
  const res = play(board, at, node.by);
  if (!res) return { ...session, status: 'wrong' };
  board = res.board;
  const moves = [...session.moves, { at, by: node.by }];

  if (node.tag === 'wrong') {
    // Play out the refutation line (first children chain), then fail.
    let cur = node;
    while (cur.children && cur.children.length) {
      cur = cur.children[0];
      const r = play(board, sgfToIdx(cur.at, size), cur.by);
      if (!r) break;
      board = r.board;
      moves.push({ at: sgfToIdx(cur.at, size), by: cur.by });
    }
    return { ...session, board, moves, status: 'refuted' };
  }

  const children = node.children || [];
  if (children.length === 0) {
    // Correct or untagged leaf: solved.
    return { ...session, board, moves, status: 'solved' };
  }
  // Opponent replies with the first answer in the tree.
  const reply = children[0];
  const r2 = play(board, sgfToIdx(reply.at, size), reply.by);
  if (!r2) return { ...session, board, moves, status: 'solved' };
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

/** Clear a transient 'wrong' status back to playing. */
function clearWrong(session) {
  return session.status === 'wrong' ? { ...session, status: 'playing' } : session;
}

/** Board index of the first correct move (for the hint ghost). */
function hintMove(problem) {
  const tree = problem.tree || [];
  const good = tree.find((n) => n.tag === 'correct' || n.children) || tree[0];
  return good ? sgfToIdx(good.at, sizeOfProblem(problem)) : null;
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
};
