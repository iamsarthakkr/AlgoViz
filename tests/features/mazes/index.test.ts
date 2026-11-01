// Contract every registered MazeGenerator must honour, so a new entry gets these checks for free.
import { describe, expect, it } from 'vitest';
import { mazeMap, mazeRegistry, mazeSections } from '@/features/mazes';
import { runMaze } from '../../helpers/grid';
import { seedRandom } from '../../helpers/random';

const ROWS = 21;
const COLS = 31;

describe('maze registry', () => {
    // labels are the keys (dropdown, mazeMap): a duplicate would shadow a generator
    it('has unique labels', () => {
        const labels = mazeRegistry.map((e) => e.label);
        expect(new Set(labels).size).toBe(labels.length);
    });

    it('can look every generator up by its label', () => {
        for (const entry of mazeRegistry) expect(mazeMap[entry.label]).toBe(entry.run);
        expect(Object.keys(mazeMap)).toHaveLength(mazeRegistry.length);
    });

    it('lists every entry once in the menu, under its group, in registry order', () => {
        const fromSections = mazeSections.flatMap((s) => s.options.map((label) => ({ label, group: s.title })));
        const byGroup = mazeSections.flatMap((s) => mazeRegistry.filter((e) => e.group === s.title));
        expect(fromSections).toEqual(byGroup.map(({ label, group }) => ({ label, group })));
        expect(fromSections).toHaveLength(mazeRegistry.length);
    });
});

describe.each(mazeRegistry)('$label', ({ run }) => {
    it('ends with exactly one done event', () => {
        seedRandom(1);
        const events = runMaze(run, ROWS, COLS);
        expect(events.at(-1)).toEqual({ type: 'done' });
        expect(events.filter((e) => e.type === 'done')).toHaveLength(1);
    });

    it('only yields in-bounds coordinates across 50 seeds', () => {
        for (let seed = 1; seed <= 50; seed++) {
            seedRandom(seed);
            for (const e of runMaze(run, ROWS, COLS)) {
                if (!('at' in e)) continue;
                expect(e.at.r).toBeGreaterThanOrEqual(0);
                expect(e.at.c).toBeGreaterThanOrEqual(0);
                expect(e.at.r).toBeLessThan(ROWS);
                expect(e.at.c).toBeLessThan(COLS);
            }
        }
    });

    it('is reproducible from a seed', () => {
        seedRandom(5);
        const first = runMaze(run, ROWS, COLS);
        seedRandom(5);
        expect(runMaze(run, ROWS, COLS)).toEqual(first);
    });
});

describe.each(mazeRegistry.filter((e) => e.group === 'Mazes'))('$label replaces the board', ({ run }) => {
    it('resets the walls first', () => {
        seedRandom(1);
        expect(['fill-wall', 'clear-wall']).toContain(runMaze(run, ROWS, COLS)[0].type);
    });
});

describe.each(mazeRegistry.filter((e) => e.group === 'Clear'))('$label only clears', ({ run }) => {
    it('draws nothing', () => {
        for (const e of runMaze(run, ROWS, COLS)) expect(['clear-wall', 'clear-weights', 'done']).toContain(e.type);
    });
});
