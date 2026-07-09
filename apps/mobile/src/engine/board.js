// 9x9 board with capture logic. Positions are 81-char strings of
// '.', 'b', 'w' in row-major order (row 0 = top), matching the
// openings database.

// The openings trainer lives on 9x9; tsumego positions may use larger
// boards (19x19 corner problems), so all board ops take an optional size
// — or infer it from the position string length.

const SIZE = 9;
const EMPTY_BOARD = '.'.repeat(SIZE * SIZE);
const GTP_COLS = 'ABCDEFGHJKLMNOPQRST'; // 'I' is skipped by convention

const sizeOf = (board) => Math.round(Math.sqrt(board.length));

const idx = (col, row, size = SIZE) => row * size + col;
const colOf = (i, size = SIZE) => i % size;
const rowOf = (i, size = SIZE) => Math.floor(i / size);

const sgfToIdx = (coord, size = SIZE) =>
  idx(coord.charCodeAt(0) - 97, coord.charCodeAt(1) - 97, size);
const idxToSgf = (i, size = SIZE) =>
  String.fromCharCode(97 + colOf(i, size)) + String.fromCharCode(97 + rowOf(i, size));
const idxToGtp = (i, size = SIZE) => GTP_COLS[colOf(i, size)] + (size - rowOf(i, size));

function neighbors(i, size = SIZE) {
  const out = [];
  const r = rowOf(i, size), c = colOf(i, size);
  if (r > 0) out.push(i - size);
  if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1);
  if (c < size - 1) out.push(i + 1);
  return out;
}

function groupAndLiberties(board, start, size) {
  const color = board[start];
  const seen = new Set([start]);
  const stack = [start];
  let liberties = 0;
  while (stack.length) {
    const cur = stack.pop();
    for (const nb of neighbors(cur, size)) {
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
  const size = sizeOf(board);
  if (board[at] !== '.') return null;
  const cells = board.split('');
  cells[at] = color;
  const enemy = color === 'b' ? 'w' : 'b';
  const captures = [];
  for (const nb of neighbors(at, size)) {
    if (cells[nb] === enemy) {
      const g = groupAndLiberties(cells, nb, size);
      if (g.liberties === 0) {
        for (const s of g.stones) {
          cells[s] = '.';
          captures.push(s);
        }
      }
    }
  }
  if (captures.length === 0 && groupAndLiberties(cells, at, size).liberties === 0) {
    return null; // suicide
  }
  return { board: cells.join(''), captures };
}

module.exports = {
  SIZE, EMPTY_BOARD, GTP_COLS, sizeOf,
  idx, colOf, rowOf, sgfToIdx, idxToSgf, idxToGtp,
  neighbors, play,
};
