import { describe, expect, it } from 'vitest';
import { prims } from '@/features/mazes/prims';
import { CellKind } from '@/types/grid';
import { applyMazeEvents, runMaze, countOpen, countReachable } from '../../helpers/grid';
import { fixRandom, seedRandom } from '../../helpers/random';

const ROWS = 21;
const COLS = 31;

describe('prims', () => {
    it('starts from a solid wall grid', () => {
        seedRandom(1);
        expect(runMaze(prims, ROWS, COLS)[0]).toEqual({ type: 'fill-wall' });
    });

    it('carves a fully connected perfect maze over the lattice', () => {
        for (let seed = 1; seed <= 25; seed++) {
            seedRandom(seed);
            const cells = applyMazeEvents(ROWS, COLS, runMaze(prims, ROWS, COLS));
            const lattice = ((ROWS - 1) / 2) * ((COLS - 1) / 2);
            for (let r = 1; r < ROWS; r += 2)
                for (let c = 1; c < COLS; c += 2) expect(cells[r * COLS + c]).toBe(CellKind.empty);
            expect(countOpen(cells)).toBe(2 * lattice - 1);
            expect(countReachable(ROWS, COLS, cells, { r: 1, c: 1 })).toBe(countOpen(cells));
        }
    });

    it('always carves a maze, even when the RNG rolls 0', () => {
        fixRandom(0);
        const cells = applyMazeEvents(ROWS, COLS, runMaze(prims, ROWS, COLS));
        expect(countOpen(cells)).toBeGreaterThan(0);
    });

    it('never picks a start outside the grid', () => {
        fixRandom(0.999999);
        const first = runMaze(prims, ROWS, COLS).find((e) => e.type === 'carve');
        expect(first?.type === 'carve' && first.at.r < ROWS && first.at.c < COLS).toBe(true);
    });
});
