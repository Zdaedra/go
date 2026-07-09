// Tsumego solving session: walks the problem's solution tree as the user
// plays. The opponent auto-replies with the tree's first answer.

const { play, sgfToIdx } = require('./board');

/** Start a session for a problem from tsumego.json. */
function startSession(problem) {
  return {
    problem,
    board: problem.board,
    nodes: problem.tree, // current move options for the user
    toMove: problem.to_move,
    status: 'playing', // 'playing' | 'solved' | 'refuted' | 'wrong'
    moves: [],
  };
}

/**
 * The user plays at `at` (board index).
 * Returns a NEW session state; status:
 *  - 'wrong'   off-tree or illegal move (board unchanged, try again)
 *  - 'refuted' the move is a known mistake; the refutation was played out
 *  - 'solved'  reached a correct leaf
 *  - 'playing' correct so far; opponent has replied
 */
function playUserMove(session, at) {
  if (session.status !== 'playing') return session;
  const node = (session.nodes || []).find(
    (n) => sgfToIdx(n.at) === at && n.by === session.toMove
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
      const r = play(board, sgfToIdx(cur.at), cur.by);
      if (!r) break;
      board = r.board;
      moves.push({ at: sgfToIdx(cur.at), by: cur.by });
    }
    return { ...session, board, moves, status: 'refuted' };
  }

  const children = node.children || [];
  if (node.tag === 'correct' && children.length === 0) {
    return { ...session, board, moves, status: 'solved' };
  }
  if (children.length === 0) {
    // Untagged leaf: treat as solved (importer marks kept leaves correct).
    return { ...session, board, moves, status: 'solved' };
  }
  // Opponent replies with the first answer in the tree.
  const reply = children[0];
  const r2 = play(board, sgfToIdx(reply.at), reply.by);
  if (!r2) return { ...session, board, moves, status: 'solved' };
  moves.push({ at: sgfToIdx(reply.at), by: reply.by });
  return {
    ...session,
    board: r2.board,
    moves,
    nodes: reply.children || [],
    status: (reply.children || []).length ? 'playing' : 'solved',
  };
}

/** Clear a transient 'wrong' status back to playing. */
function clearWrong(session) {
  return session.status === 'wrong' ? { ...session, status: 'playing' } : session;
}

/** Board index of the first correct move (for the hint ghost). */
function hintMove(problem) {
  const good =
    problem.tree.find((n) => n.tag === 'correct' || n.children) || problem.tree[0];
  return good ? sgfToIdx(good.at) : null;
}

module.exports = { startSession, playUserMove, clearWrong, hintMove };
