export const COLS = 'ABCDEFGHJ'.split(''); // skip I
export const ROWS = '123456789'.split('').reverse(); // 9 at top, 1 at bottom

export function parseCoord(coord: string) {
    if (!coord || coord.length < 2) return null;
    const colStr = coord[0].toUpperCase();
    const rowStr = coord.substring(1);
    const x = COLS.indexOf(colStr);
    const y = ROWS.indexOf(rowStr);
    if (x === -1 || y === -1) return null;
    return { x, y };
}
