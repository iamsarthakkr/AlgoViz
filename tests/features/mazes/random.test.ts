import { describe, expect, it } from 'vitest';
import { randomGenerator } from '@/features/mazes/random';
import { CellKind } from '@/types/grid';
import { applyMazeEvents, runMaze } from '../../helpers/grid';
import { fixRandom, seedRandom } from '../../helpers/random';

describe('random walls', () => {
    it('clears existing walls first', () => {
        seedRandom(1);
        expect(runMaze(randomGenerator, 10, 10)[0]).toEqual({ type: 'clear-wall' });
    });

    it('never walls an odd/odd cell, so there is always open space', () => {
        fixRandom(0); // every coin flip lands on "wall"
        const cells = applyMazeEvents(11, 11, runMaze(randomGenerator, 11, 11));
        for (let r = 1; r < 11; r += 2) for (let c = 1; c < 11; c += 2) expect(cells[r * 11 + c]).toBe(CellKind.empty);
    });

    it('walls roughly 35% of the eligible cells', () => {
        seedRandom(21);
        const rows = 41,
            cols = 61;
        const walls = runMaze(randomGenerator, rows, cols).filter((e) => e.type === 'wall').length;
        const eligible = rows * cols - Math.floor(rows / 2) * Math.floor(cols / 2);
        expect(walls / eligible).toBeGreaterThan(0.3);
        expect(walls / eligible).toBeLessThan(0.4);
    });
});
