// Authored by - Sarthak Kumar
//
// grid utils: initGrid builds the default grid; nearestEmptyCell is a small BFS used by
// useGridStore to snap a marker off of a wall cell (toAvoid keeps the two markers apart).

import { CellKind, Coord, Grid } from '@/types/grid';
import { CELL_SIZE, COLS, DEFAULT_WEIGHT, ROWS } from './constants';

// initialize grid
export const initGrid = (rows = ROWS, cols = COLS, cellSize = CELL_SIZE): Grid => {
    const cells: CellKind[] = Array(rows * cols).fill(CellKind.empty);
    const weights: number[] = Array(rows * cols).fill(DEFAULT_WEIGHT);
    const start = { r: Math.floor(rows / 2), c: Math.floor(cols / 6) };
    const goal = { r: Math.floor(rows / 2), c: Math.floor((cols * 5) / 6) };
    return {
        gridVersion: 0,
        rows,
        cols,
        cellSize,
        cells,
        weights,
        start,
        goal,
        gridLock: false,
        markersHidden: false,
    };
};

// tiny bfs around a cell to find nearest empty cell
export const nearestEmptyCell = (
    r: number,
    c: number,
    rows: number,
    cols: number,
    cells: CellKind[],
    toAvoid: Coord[] = [],
): Coord => {
    const idx = (rr: number, cc: number) => rr * cols + cc;
    const inb = (rr: number, cc: number) => rr >= 0 && cc >= 0 && rr < rows && cc < cols;
    const q: [number, number][] = [[r, c]];
    const seen = new Array<boolean>(rows * cols).fill(false);
    const deltas = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ];
    while (q.length) {
        const [rr, cc] = q.shift()!;
        const avoided = toAvoid.some((a) => a.r === rr && a.c === cc);
        if (!avoided && cells[idx(rr, cc)] !== CellKind.wall) return { r: rr, c: cc };
        for (const [dr, dc] of deltas) {
            const nr = rr + dr,
                nc = cc + dc,
                key = idx(nr, nc);
            if (inb(nr, nc) && !seen[key]) {
                seen[key] = true;
                q.push([nr, nc]);
            }
        }
    }
    return { r, c }; // shouldn't be possible
};
