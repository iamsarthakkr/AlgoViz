import { describe, expect, it } from 'vitest';
import { initGrid, nearestEmptyCell } from '@/utils/grid';
import { CELL_SIZE, COLS, ROWS } from '@/utils/constants';
import { CellKind } from '@/types/grid';
import { parseGrid } from '../helpers/grid';

describe('initGrid', () => {
    it('uses the default dimensions', () => {
        const g = initGrid();
        expect(g).toMatchObject({ rows: ROWS, cols: COLS, cellSize: CELL_SIZE, gridVersion: 0, gridLock: false });
        expect(g.cells).toHaveLength(ROWS * COLS);
        expect(g.cells.every((k) => k === CellKind.empty)).toBe(true);
    });

    it('places start and goal on the middle row, distinct and in bounds', () => {
        const g = initGrid(10, 30, 12);
        expect(g.start).toEqual({ r: 5, c: 5 });
        expect(g.goal).toEqual({ r: 5, c: 25 });
    });
});

describe('nearestEmptyCell', () => {
    it('returns the cell itself when it is empty', () => {
        const g = parseGrid(['S..', '...', '..G']);
        expect(nearestEmptyCell(1, 1, g.rows, g.cols, g.cells)).toEqual({ r: 1, c: 1 });
    });

    it('snaps off a wall to the closest empty cell', () => {
        const g = parseGrid(['S###', '####', '###.', '###G']);
        expect(nearestEmptyCell(1, 2, g.rows, g.cols, g.cells)).toEqual({ r: 2, c: 3 });
    });

    // showMarkers uses this so the two markers can't land on the same cell
    it('skips cells in toAvoid, moving on to the next closest', () => {
        const g = parseGrid(['S...', '....', '...G']);
        expect(nearestEmptyCell(1, 1, g.rows, g.cols, g.cells, [{ r: 1, c: 1 }])).toEqual({ r: 0, c: 1 });
        const avoid = [
            { r: 1, c: 1 },
            { r: 0, c: 1 },
        ];
        expect(nearestEmptyCell(1, 1, g.rows, g.cols, g.cells, avoid)).toEqual({ r: 2, c: 1 });
    });

    it('falls back to the requested cell when the whole grid is walls', () => {
        const cells = Array(9).fill(CellKind.wall);
        expect(nearestEmptyCell(1, 1, 3, 3, cells)).toEqual({ r: 1, c: 1 });
    });
});
