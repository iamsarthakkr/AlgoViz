import { describe, expect, it } from 'vitest';
import { astar } from '@/features/algo/astar';
import { dijkstra } from '@/features/algo/dijkstra';
import { CellKind } from '@/types/grid';
import { WEIGHT_LEVELS } from '@/utils/constants';
import { costOf, emptyGrid, expectValidPath, parseGrid, referenceCost, runToPath } from '../../helpers/grid';
import { seedRandom } from '../../helpers/random';

const ROWS = 21;
const COLS = 35;

// a mix of walls and weights, with the marker cells plain as in a real snapshot
function randomGrid() {
    const grid = emptyGrid(ROWS, COLS, { r: 0, c: 0 }, { r: ROWS - 1, c: COLS - 1 });
    const last = ROWS * COLS - 1;
    grid.cells = grid.cells.map((_, i) =>
        i !== 0 && i !== last && Math.random() < 0.2 ? CellKind.wall : CellKind.empty,
    );
    grid.weights = grid.weights.map((w, i) => {
        if (i === 0 || i === last || grid.cells[i] === CellKind.wall || Math.random() < 0.6) return w;
        return WEIGHT_LEVELS[Math.floor(Math.random() * WEIGHT_LEVELS.length)];
    });
    return grid;
}

describe('astar', () => {
    it('goes around heavy terrain when that is cheaper', () => {
        const grid = parseGrid([
            '.......', //
            'S33333G',
            '##...##',
        ]);
        const { path } = runToPath(astar(grid));
        expectValidPath(grid, path.nodes);
        expect(path.cost).toBe(referenceCost(grid));
    });

    it('crosses heavy terrain when going around costs more', () => {
        const grid = parseGrid([
            '###.###', //
            'S..1..G',
            '#######',
        ]);
        const { path } = runToPath(astar(grid));
        expect(path.nodes).toHaveLength(7);
        expect(path.cost).toBe(costOf(grid, path.nodes));
    });

    // The promise of `shortest: 'always'`, on a board big enough that one dropped cell shows: a stale
    // check that rebuilt g from a fractional f lost cells to rounding, and cost more on most seeds
    it('costs the same as dijkstra on every seed', () => {
        for (let seed = 1; seed <= 60; seed++) {
            seedRandom(seed);
            const grid = randomGrid();
            const expected = runToPath(dijkstra(grid)).path.cost;
            expect(runToPath(astar(grid)).path.cost).toBe(expected);
        }
    });

    it('visits fewer cells than dijkstra on an open board', () => {
        const grid = emptyGrid(ROWS, COLS, { r: 10, c: 2 }, { r: 10, c: 32 });
        expect(runToPath(astar(grid)).path.visited).toBeLessThan(runToPath(dijkstra(grid)).path.visited);
    });

    // on an open board every cell between start and goal ties on f; the tie-break walks straight there
    it('goes straight to the goal on an open board', () => {
        const grid = emptyGrid(ROWS, COLS, { r: 3, c: 2 }, { r: 15, c: 30 });
        const { path } = runToPath(astar(grid));
        expect(path.visited).toBe(path.nodes.length);
    });

    it('explores everything it can reach before giving up on a blocked goal', () => {
        const grid = parseGrid([
            'S..#..', //
            '...#..',
            '...#.G',
        ]);
        const { path } = runToPath(astar(grid));
        expect(path.nodes).toEqual([]);
        expect(path.visited).toBe(runToPath(dijkstra(grid)).path.visited);
    });
});
