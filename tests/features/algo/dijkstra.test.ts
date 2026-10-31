import { describe, expect, it } from 'vitest';
import { dijkstra } from '@/features/algo/dijkstra';
import { bfs } from '@/features/algo/bfs';
import { WEIGHT_LEVELS } from '@/utils/constants';
import { emptyGrid, parseGrid, runToPath } from '../../helpers/grid';

describe('dijkstra', () => {
    it('does not emit a visit event for the goal itself', () => {
        const grid = emptyGrid(4, 4, { r: 0, c: 0 }, { r: 3, c: 3 });
        const visits = runToPath(dijkstra(grid)).events.filter((e) => e.type === 'visit');
        expect(visits.some((e) => e.type === 'visit' && e.at.r === 3 && e.at.c === 3)).toBe(false);
    });

    // with every cell plain, dijkstra and BFS agree: the difference only shows on weighted grids
    it('produces the same path length as BFS on a plain grid', () => {
        const grid = emptyGrid(10, 10, { r: 0, c: 0 }, { r: 9, c: 6 });
        expect(runToPath(dijkstra(grid)).path.nodes.length).toBe(runToPath(bfs(grid)).path.nodes.length);
    });

    describe('on a weighted grid', () => {
        const HEAVY_BETWEEN = parseGrid([
            'S3G', //
            '...',
        ]);
        const LIGHT_BETWEEN = parseGrid([
            'S1G', //
            '...',
        ]);
        const [LIGHT] = WEIGHT_LEVELS;

        it('detours around a heavy cell when that is cheaper', () => {
            const { path } = runToPath(dijkstra(HEAVY_BETWEEN));
            expect(path.nodes).toHaveLength(5); // down, across, up
            expect(path.cost).toBe(4);
        });

        it('goes straight through when the detour costs more', () => {
            const { path } = runToPath(dijkstra(LIGHT_BETWEEN));
            expect(path.nodes).toHaveLength(3);
            expect(path.cost).toBe(LIGHT + 1);
        });

        // the reason the path event reports a cost for every algorithm
        it('finds a cheaper path than BFS, which ignores weights', () => {
            const dijkstraPath = runToPath(dijkstra(HEAVY_BETWEEN)).path;
            const bfsPath = runToPath(bfs(HEAVY_BETWEEN)).path;
            expect(bfsPath.nodes.length).toBeLessThan(dijkstraPath.nodes.length);
            expect(bfsPath.cost).toBeGreaterThan(dijkstraPath.cost);
        });

        // the first route to reach the goal isn't the cheapest, so it must stop on pop, not on enqueue
        it('keeps looking after first reaching the goal by an expensive route', () => {
            const grid = parseGrid([
                'S3G', //
                '...',
            ]);
            grid.weights[2] = LIGHT; // the goal itself costs the same from either side
            expect(runToPath(dijkstra(grid)).path.cost).toBe(3 + LIGHT);
        });
    });
});
