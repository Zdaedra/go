// 9x9 board with capture logic. Positions are 81-char strings of
// '.', 'b', 'w' in row-major order (row 0 = top), matching the
// openings database.

const SIZE = 9;
const EMPTY_BOARD = '.'.repeat(SIZE * SIZE);
const GTP_COLS = 'ABCDEFGHJ'; // 'I' is skipped by convention

const idx = (col, row) => row * SIZE + col;
const colOf = (i) => i % SIZE;
const rowOf = (i) => Math.floor(i / SIZE);

const sgfToIdx = (coord) => idx(coord.charCodeAt(0) - 97, coord.charCodeAt(1) - 97);
const idxToSgf = (i) =>
  String.fromCharCode(97 + colOf(i)) + String.fromCharCode(97 + rowOf(i));
const idxToGtp = (i) => GTP_COLS[colOf(i)] + (SIZE - rowOf(i));

function neighbors(i) {
  const out = [];
  const r = rowOf(i), c = colOf(i);
  if (r > 0) out.push(i - SIZE);
  if (r < SIZE - 1) out.push(i + SIZE);
  if (c > 0) out.push(i - 1);
  if (c < SIZE - 1) out.push(i + 1);
  return out;
}

function groupAndLiberties(board, start) {
  const color = board[start];
  const seen = new Set([start]);
  const stack = [start];
  let liberties = 0;
  while (stack.length) {
    const cur = stack.pop();
    for (const nb of neighbors(cur)) {
      if (board[nb] === '.') liberties++;
      else if (board[nb] === color && !seen.has(nb)) {
        seen.add(nb);
        stack.push(nb);
      }
    }
  }
  return { liberties, stones: [...seen] };
}

/**
 * Play a move. Returns { board, captures } with captures removed, or null
 * if the point is occupied or the move would be suicide.
 * `board` is an 81-char string; `color` is 'b' | 'w'.
 */
function play(board, at, color) {
  if (board[at] !== '.') return null;
  const cells = board.split('');
  cells[at] = color;
  const enemy = color === 'b' ? 'w' : 'b';
  const captures = [];
  for (const nb of neighbors(at)) {
    if (cells[nb] === enemy) {
      const g = groupAndLiberties(cells, nb);
      if (g.liberties === 0) {
        for (const s of g.stones) {
          cells[s] = '.';
          captures.push(s);
        }
      }
    }
  }
  if (captures.length === 0 && groupAndLiberties(cells, at).liberties === 0) {
    return null; // suicide
  }
  return { board: cells.join(''), captures };
}

module.exports = {
  SIZE, EMPTY_BOARD, GTP_COLS,
  idx, colOf, rowOf, sgfToIdx, idxToSgf, idxToGtp,
  neighbors, play,
};
