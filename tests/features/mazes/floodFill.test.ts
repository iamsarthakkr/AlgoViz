import { describe, expect, it } from 'vitest';
import { floodFill } from '@/features/mazes/floodFill';
import { CellKind } from '@/types/grid';
import { applyMazeEvents, runMaze, countOpen, countReachable } from '../../helpers/grid';
import { fixRandom, seedRandom } from '../../helpers/random';

const ROWS = 21;
const COLS = 31;

describe('floodFill (randomized DFS)', () => {
    it('starts from a solid wall grid', () => {
        seedRandom(1);
        expect(runMaze(floodFill, ROWS, COLS)[0]).toEqual({ type: 'fill-wall' });
    });

    it('carves every lattice cell and leaves the maze fully connected', () => {
        for (let seed = 1; seed <= 25; seed++) {
            seedRandom(seed);
            const cells = applyMazeEvents(ROWS, COLS, runMaze(floodFill, ROWS, COLS));
            for (let r = 1; r < ROWS; r += 2)
                for (let c = 1; c < COLS; c += 2) expect(cells[r * COLS + c]).toBe(CellKind.empty);
            expect(countReachable(ROWS, COLS, cells, { r: 1, c: 1 })).toBe(countOpen(cells));
        }
    });

    // A perfect maze has exactly one route between any two cells: lattice cells − 1 passages
    it('carves a perfect maze (a spanning tree, no loops)', () => {
        seedRandom(6);
        const cells = applyMazeEvents(ROWS, COLS, runMaze(floodFill, ROWS, COLS));
        const lattice = ((ROWS - 1) / 2) * ((COLS - 1) / 2);
        expect(countOpen(cells)).toBe(lattice + (lattice - 1));
    });

    it('always carves a maze, even when the RNG rolls 0', () => {
        fixRandom(0);
        const cells = applyMazeEvents(ROWS, COLS, runMaze(floodFill, ROWS, COLS));
        expect(countOpen(cells)).toBeGreaterThan(0);
    });

    it('never picks a start outside the grid', () => {
        fixRandom(0.999999);
        const first = runMaze(floodFill, ROWS, COLS).find((e) => e.type === 'carve');
        expect(first?.type === 'carve' && first.at.r < ROWS && first.at.c < COLS).toBe(true);
    });
});
