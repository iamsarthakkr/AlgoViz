// Contract every registered PathFinder must honour, so a new algorithm gets these checks
// for free just by being added to the registry.
import { describe, expect, it } from 'vitest';
import { algoLabels, algoRegistry, algorithmMap } from '@/features/algo';
import { CellKind } from '@/types/grid';
import { WEIGHT_LEVELS } from '@/utils/constants';
import { costOf, emptyGrid, expectValidPath, parseGrid, referenceCost, runToPath } from '../../helpers/grid';
import { seedRandom } from '../../helpers/random';

const OPEN = parseGrid([
    'S.....', //
    '.##.#.',
    '...#..',
    '.#...G',
]);

const BLOCKED = parseGrid([
    'S..#..', //
    '...#..',
    '...#.G',
]);

// the middle row is the short way, and heavy; the top row is longer and cheap
const WEIGHTED = parseGrid([
    '......', //
    'S3333G',
    '##..##',
]);

// a seeded mix of walls and weights, with the marker cells plain as in a real snapshot
function randomWeightedGrid() {
    const rows = 10;
    const cols = 14;
    const grid = emptyGrid(rows, cols, { r: 0, c: 0 }, { r: rows - 1, c: cols - 1 });
    const last = rows * cols - 1;
    grid.cells = grid.cells.map((_, i) =>
        i !== 0 && i !== last && Math.random() < 0.2 ? CellKind.wall : CellKind.empty,
    );
    grid.weights = grid.weights.map((w, i) => {
        if (i === 0 || i === last || grid.cells[i] === CellKind.wall || Math.random() < 0.4) return w;
        return WEIGHT_LEVELS[Math.floor(Math.random() * WEIGHT_LEVELS.length)];
    });
    return grid;
}

describe('algorithm registry', () => {
    // labels are the keys (dropdown, settings store, algorithmMap): a duplicate would shadow an algorithm
    it('has unique labels', () => {
        expect(new Set(algoLabels).size).toBe(algoLabels.length);
    });

    it('can look every algorithm up by its label', () => {
        for (const entry of algoRegistry) expect(algorithmMap[entry.label]).toBe(entry.run);
        expect(Object.keys(algorithmMap)).toHaveLength(algoRegistry.length);
    });

    it('describes every algorithm (the info dialog shows it)', () => {
        for (const entry of algoRegistry) expect(entry.description.trim()).not.toBe('');
    });

    // The UI and the weighted-grid contract rely on these flags (e.g. "BFS ignores weights"), so a
    // wrong flag must fail here rather than show a wrong message. A new algorithm must be added here.
    it('declares the expected metadata for each algorithm', () => {
        const flags = Object.fromEntries(
            algoRegistry.map((e) => [e.label, { weighted: e.weighted, shortest: e.shortest }]),
        );
        expect(flags).toEqual({
            'Breadth-first search': { weighted: false, shortest: 'unweighted-only' },
            'Depth-first search': { weighted: false, shortest: 'never' },
            'Bidirectional BFS': { weighted: false, shortest: 'unweighted-only' },
            "Dijkstra's": { weighted: true, shortest: 'always' },
        });
    });
});

describe.each(algoRegistry)('$label', (entry) => {
    const algo = entry.run;
    it('starts by enqueueing the start cell', () => {
        const { events } = runToPath(algo(OPEN));
        expect(events[0]).toEqual({ type: 'enqueue', at: OPEN.start });
    });

    it('ends with exactly one path event, and it is last', () => {
        const { events } = runToPath(algo(OPEN));
        expect(events.filter((e) => e.type === 'path')).toHaveLength(1);
    });

    it('finds a valid start→goal path around walls', () => {
        const { path } = runToPath(algo(OPEN));
        expectValidPath(OPEN, path.nodes);
    });

    it('returns an empty path when the goal is walled off', () => {
        const { path } = runToPath(algo(BLOCKED));
        expect(path.nodes).toEqual([]);
    });

    // The store never lets start and goal overlap, but the generator contract shouldn't rely on that
    describe('when start is the goal', () => {
        const SAME = emptyGrid(9, 9, { r: 4, c: 4 }, { r: 4, c: 4 });

        it('returns a path of just the start cell', () => {
            expect(runToPath(algo(SAME)).path.nodes).toEqual([{ r: 4, c: 4 }]);
        });

        it('finishes without exploring the grid', () => {
            const { events, path } = runToPath(algo(SAME));
            const explored = events.filter((e) => e.type !== 'path' && (e.at.r !== 4 || e.at.c !== 4));
            expect(explored).toEqual([]);
            expect(path.visited).toBeLessThanOrEqual(1);
        });
    });

    it('never visits or enqueues a wall or an out-of-bounds cell', () => {
        for (const grid of [OPEN, BLOCKED]) {
            for (const e of runToPath(algo(grid)).events) {
                if (e.type === 'path') continue;
                expect(e.at.r).toBeGreaterThanOrEqual(0);
                expect(e.at.c).toBeGreaterThanOrEqual(0);
                expect(e.at.r).toBeLessThan(grid.rows);
                expect(e.at.c).toBeLessThan(grid.cols);
                expect(grid.cells[e.at.r * grid.cols + e.at.c]).toBe(CellKind.empty);
            }
        }
    });

    it('never visits the same cell twice', () => {
        const { events } = runToPath(algo(OPEN));
        const visits = events.filter((e) => e.type === 'visit').map((e) => `${e.at.r},${e.at.c}`);
        expect(new Set(visits).size).toBe(visits.length);
    });

    it('reports a visited count matching what it explored', () => {
        const { events, path } = runToPath(algo(OPEN));
        const visits = events.filter((e) => e.type === 'visit').length;
        // dijkstra counts the goal pop without yielding a visit event for it
        expect(path.visited - visits).toBeGreaterThanOrEqual(0);
        expect(path.visited - visits).toBeLessThanOrEqual(1);
    });

    it('does not mutate the grid it was given', () => {
        const before = structuredClone(OPEN);
        runToPath(algo(OPEN));
        expect(OPEN).toEqual(before);
    });

    it('finds a valid path on random grids whenever one exists', () => {
        seedRandom(11);
        for (let trial = 0; trial < 40; trial++) {
            const grid = emptyGrid(12, 16, { r: 0, c: 0 }, { r: 11, c: 15 });
            grid.cells = grid.cells.map((_, i) =>
                i !== 0 && i !== grid.cells.length - 1 && Math.random() < 0.3 ? CellKind.wall : CellKind.empty,
            );
            const { path } = runToPath(algo(grid));
            if (path.nodes.length) expectValidPath(grid, path.nodes);
        }
    });

    it('reports what its path really costs, on weighted grids too', () => {
        for (const grid of [OPEN, BLOCKED, WEIGHTED]) {
            const { path } = runToPath(algo(grid));
            expect(path.cost).toBe(costOf(grid, path.nodes));
        }
    });

    it('costs the number of steps on a plain grid', () => {
        const { path } = runToPath(algo(OPEN));
        expect(path.cost).toBe(path.nodes.length - 1);
    });

    it('costs nothing when there is no path, or the start is the goal', () => {
        expect(runToPath(algo(BLOCKED)).path.cost).toBe(0);
        expect(runToPath(algo(emptyGrid(3, 3, { r: 1, c: 1 }, { r: 1, c: 1 }))).path.cost).toBe(0);
    });

    it('never beats the cheapest possible path on random weighted grids', () => {
        seedRandom(19);
        for (let trial = 0; trial < 30; trial++) {
            const grid = randomWeightedGrid();
            const { path } = runToPath(algo(grid));
            if (path.nodes.length) expect(path.cost).toBeGreaterThanOrEqual(referenceCost(grid));
        }
    });
});

// The promise behind `shortest: 'always'`: a new weighted algorithm gets this check by being registered
describe.each(algoRegistry.filter((e) => e.shortest === 'always'))('$label finds the cheapest path', (entry) => {
    it('on random weighted grids', () => {
        seedRandom(23);
        for (let trial = 0; trial < 40; trial++) {
            const grid = randomWeightedGrid();
            const best = referenceCost(grid);
            const { path } = runToPath(entry.run(grid));
            expect(path.nodes.length ? path.cost : -1).toBe(best);
        }
    });

    it('reads the weights', () => {
        expect(entry.weighted).toBe(true);
    });
});
