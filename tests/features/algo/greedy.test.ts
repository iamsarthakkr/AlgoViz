import { describe, expect, it } from 'vitest';
import { greedy } from '@/features/algo/greedy';
import { astar } from '@/features/algo/astar';
import { bfs } from '@/features/algo/bfs';
import { emptyGrid, expectValidPath, parseGrid, referenceCost, runToPath } from '../../helpers/grid';

describe('greedy', () => {
    it('goes straight to the goal on an open board', () => {
        const grid = emptyGrid(21, 35, { r: 3, c: 2 }, { r: 15, c: 30 });
        const { path } = runToPath(greedy(grid));
        expect(path.visited).toBe(path.nodes.length);
    });

    // the cells nearest the goal lead over the top; greedy follows them and keeps the first parent it
    // found, so its path is longer than the one along the bottom row
    it('takes a longer route than the shortest one when the goal looks closer than it is', () => {
        const grid = parseGrid([
            '#...#..', //
            '..#...#',
            'S.#..#G',
            '.#.#.#.',
            '.......',
        ]);
        const { path } = runToPath(greedy(grid));
        expectValidPath(grid, path.nodes);
        expect(path.nodes.length).toBeGreaterThan(runToPath(bfs(grid)).path.nodes.length);
    });

    it('ignores weights and walks through heavy terrain', () => {
        const grid = parseGrid([
            '.......', //
            'S33333G',
            '##...##',
        ]);
        const { path } = runToPath(greedy(grid));
        expect(path.nodes).toHaveLength(7);
        expect(path.cost).toBeGreaterThan(referenceCost(grid));
        expect(runToPath(astar(grid)).path.cost).toBe(referenceCost(grid));
    });

    it('explores everything it can reach before giving up on a blocked goal', () => {
        const grid = parseGrid([
            'S..#..', //
            '...#..',
            '...#.G',
        ]);
        const { path } = runToPath(greedy(grid));
        expect(path.nodes).toEqual([]);
        expect(path.visited).toBe(9);
    });
});
