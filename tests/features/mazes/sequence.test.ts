import { describe, expect, it, vi } from 'vitest';
import { sequence } from '@/features/mazes/sequence';
import { CellKind } from '@/types/grid';
import { MazeGenerator } from '@/types/mazeGenerator';
import { collect, runMaze } from '../../helpers/grid';

const ROWS = 3;
const COLS = 4;

// carves one cell in column `c`, then finishes
const step = (c: number): MazeGenerator =>
    function* () {
        yield { type: 'carve', at: { r: 0, c } };
        yield { type: 'done' };
    };

describe('sequence', () => {
    it('runs the generators in order', () => {
        const events = runMaze(sequence(step(0), step(1), step(2)), ROWS, COLS);
        expect(events.flatMap((e) => (e.type === 'carve' ? [e.at.c] : []))).toEqual([0, 1, 2]);
    });

    // the runner's cleanup runs on done: an inner one would unlock the grid halfway through
    it('has exactly one done, at the very end', () => {
        const events = runMaze(sequence(step(0), step(1)), ROWS, COLS);
        expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
        expect(events.at(-1)).toEqual({ type: 'done' });
    });

    it('still ends with done when given nothing to run', () => {
        expect(runMaze(sequence(), ROWS, COLS)).toEqual([{ type: 'done' }]);
    });

    it('still ends with done when a generator never yields done', () => {
        const noDone: MazeGenerator = function* () {
            yield { type: 'carve', at: { r: 0, c: 0 } };
        };
        expect(runMaze(sequence(noDone), ROWS, COLS).at(-1)).toEqual({ type: 'done' });
    });

    it('can be nested without a second done', () => {
        const events = runMaze(sequence(sequence(step(0), step(1)), step(2)), ROWS, COLS);
        expect(events.map((e) => e.type)).toEqual(['carve', 'carve', 'carve', 'done']);
    });

    it('passes the size and the board getter to every generator', () => {
        const seen: unknown[][] = [];
        const spy: MazeGenerator = function* (...args) {
            seen.push(args);
            yield { type: 'done' };
        };
        const getCells = () => [CellKind.empty];
        collect(sequence(spy, spy)(ROWS, COLS, getCells));
        expect(seen).toEqual([
            [ROWS, COLS, getCells],
            [ROWS, COLS, getCells],
        ]);
    });

    // the preset depends on this: Add Loops has to read the walls the maze before it built
    it('starts a generator only when the one before has finished', () => {
        const log: string[] = [];
        const named = (name: string): MazeGenerator =>
            function* () {
                log.push(`start ${name}`);
                yield { type: 'carve', at: { r: 0, c: 0 } };
                log.push(`end ${name}`);
            };
        collect(sequence(named('a'), named('b'))(ROWS, COLS, () => []));
        expect(log).toEqual(['start a', 'end a', 'start b', 'end b']);
    });

    // cancelling a run just stops pulling events: nothing later may start
    it('starts nothing more once the consumer stops', () => {
        const later = vi.fn(function* () {
            yield { type: 'done' as const };
        });
        const gen = sequence(step(0), later)(ROWS, COLS, () => []);
        gen.next();
        expect(later).not.toHaveBeenCalled();
    });
});
