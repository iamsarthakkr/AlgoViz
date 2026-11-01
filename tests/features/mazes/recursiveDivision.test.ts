import { describe, expect, it } from 'vitest';
import { recursiveDivision } from '@/features/mazes/recursiveDivision';
import { CellKind } from '@/types/grid';
import { applyMazeEvents, runMaze, countOpen, countReachable } from '../../helpers/grid';
import { seedRandom } from '../../helpers/random';

const ROWS = 21;
const COLS = 31;

const build = (prob?: number) => applyMazeEvents(ROWS, COLS, runMaze(recursiveDivision(prob), ROWS, COLS));

describe('recursiveDivision', () => {
    it('walls in the whole outer border', () => {
        seedRandom(1);
        const cells = build();
        for (let c = 0; c < COLS; c++) {
            expect(cells[c]).toBe(CellKind.wall);
            expect(cells[(ROWS - 1) * COLS + c]).toBe(CellKind.wall);
        }
        for (let r = 0; r < ROWS; r++) {
            expect(cells[r * COLS]).toBe(CellKind.wall);
            expect(cells[r * COLS + COLS - 1]).toBe(CellKind.wall);
        }
    });

    it.each([0.5, 0.7, 0.3])('leaves every open cell connected (vertical_prob %f)', (prob) => {
        for (let seed = 1; seed <= 25; seed++) {
            seedRandom(seed);
            const cells = build(prob);
            expect(countReachable(ROWS, COLS, cells, { r: 1, c: 1 })).toBe(countOpen(cells));
        }
    });

    it('keeps odd/odd lattice cells open so markers always have somewhere to land', () => {
        seedRandom(9);
        const cells = build();
        for (let r = 1; r < ROWS - 1; r += 2)
            for (let c = 1; c < COLS - 1; c += 2) expect(cells[r * COLS + c]).toBe(CellKind.empty);
    });

    it('only splits vertically with vertical_prob = 1, horizontally with 0', () => {
        seedRandom(3);
        const vertical = runMaze(recursiveDivision(1), ROWS, COLS);
        seedRandom(3);
        const horizontal = runMaze(recursiveDivision(0), ROWS, COLS);
        // first interior wall after the 4 border passes
        const border = 2 * COLS + 2 * ROWS;
        const [v1, v2] = vertical.filter((e) => e.type === 'wall').slice(border);
        const [h1, h2] = horizontal.filter((e) => e.type === 'wall').slice(border);
        expect(v1.type === 'wall' && v2.type === 'wall' && v1.at.c === v2.at.c).toBe(true);
        expect(h1.type === 'wall' && h2.type === 'wall' && h1.at.r === h2.at.r).toBe(true);
    });

    it('produces just the border on grids too small to divide', () => {
        seedRandom(1);
        const cells = applyMazeEvents(4, 4, runMaze(recursiveDivision(), 4, 4));
        expect(countOpen(cells)).toBe(4);
    });
});
