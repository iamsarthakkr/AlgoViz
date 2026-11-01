import { describe, expect, it } from 'vitest';
import { dijkstra } from '@/features/algo/dijkstra';
import { randomWeightsGenerator } from '@/features/mazes/randomWeights';
import { CellKind, Coord } from '@/types/grid';
import { MazeGeneratorEvent, WeightEvent } from '@/types/mazeGenerator';
import { WEIGHT_LEVELS } from '@/utils/constants';
import { emptyGrid, referenceCost, runMaze, runToPath } from '../../helpers/grid';
import { fixRandom, seedRandom } from '../../helpers/random';

const ROWS = 21;
const COLS = 31;
const WEIGHT_PROB = 0.3;

const isWeight = (e: MazeGeneratorEvent): e is WeightEvent => e.type === 'weight';
const key = (at: Coord) => at.r * COLS + at.c;
const open = () => Array<CellKind>(ROWS * COLS).fill(CellKind.empty);

describe('random weights', () => {
    it('clears the old weights first, and ends with done', () => {
        seedRandom(1);
        const events = runMaze(randomWeightsGenerator, ROWS, COLS);
        expect(events[0]).toEqual({ type: 'clear-weights' });
        expect(events.at(-1)).toEqual({ type: 'done' });
    });

    it('can place a weight on every open cell, once each', () => {
        fixRandom(0); // every coin flip lands on "weight"
        const cells = runMaze(randomWeightsGenerator, ROWS, COLS).filter(isWeight);
        expect(new Set(cells.map((e) => key(e.at))).size).toBe(ROWS * COLS);
        expect(cells).toHaveLength(ROWS * COLS);
    });

    it('places nothing when no coin flip lands', () => {
        fixRandom(0.99);
        expect(runMaze(randomWeightsGenerator, ROWS, COLS).map((e) => e.type)).toEqual(['clear-weights', 'done']);
    });

    it('weights roughly 30% of the open cells', () => {
        seedRandom(21);
        const share = runMaze(randomWeightsGenerator, ROWS, COLS).filter(isWeight).length / (ROWS * COLS);
        expect(share).toBeGreaterThan(WEIGHT_PROB - 0.05);
        expect(share).toBeLessThan(WEIGHT_PROB + 0.05);
    });

    // the off-by-one that picked WEIGHT_LEVELS[length] would show up here as an extra value
    it('uses exactly the weight levels, each of them', () => {
        seedRandom(4);
        const used = new Set(
            runMaze(randomWeightsGenerator, ROWS, COLS)
                .filter(isWeight)
                .map((e) => e.w),
        );
        expect([...used].sort((a, b) => a - b)).toEqual([...WEIGHT_LEVELS].sort((a, b) => a - b));
    });

    it('skips walls, and places everything else', () => {
        fixRandom(0);
        const cells = open();
        cells[key({ r: 3, c: 4 })] = CellKind.wall;
        cells[key({ r: 0, c: 0 })] = CellKind.wall;
        const placed = new Set(
            runMaze(randomWeightsGenerator, ROWS, COLS, cells)
                .filter(isWeight)
                .map((e) => key(e.at)),
        );
        expect(placed.has(key({ r: 3, c: 4 }))).toBe(false);
        expect(placed.has(key({ r: 0, c: 0 }))).toBe(false);
        expect(placed.size).toBe(ROWS * COLS - 2);
    });

    it('places nothing on a board of walls', () => {
        fixRandom(0);
        const walls = Array<CellKind>(ROWS * COLS).fill(CellKind.wall);
        expect(runMaze(randomWeightsGenerator, ROWS, COLS, walls).filter(isWeight)).toEqual([]);
    });

    describe('with the path algorithms', () => {
        const START = { r: 0, c: 0 };
        const GOAL = { r: ROWS - 1, c: COLS - 1 };

        // the markers count as plain, as in a real snapshot
        const weightedGrid = () => {
            const grid = emptyGrid(ROWS, COLS, START, GOAL);
            for (const e of runMaze(randomWeightsGenerator, ROWS, COLS).filter(isWeight)) {
                if (key(e.at) !== key(START) && key(e.at) !== key(GOAL)) grid.weights[key(e.at)] = e.w;
            }
            return grid;
        };

        // a cell with an undefined weight never entered dijkstra's queue, leaving white holes in a run
        it('leaves no cell unreachable for dijkstra', () => {
            seedRandom(9);
            const grid = weightedGrid();
            // wall the goal off, so the search covers the whole board
            grid.cells[key({ r: ROWS - 2, c: COLS - 1 })] = CellKind.wall;
            grid.cells[key({ r: ROWS - 1, c: COLS - 2 })] = CellKind.wall;
            const reached = new Set<number>();
            for (const e of runToPath(dijkstra(grid)).events) if (e.type === 'visit') reached.add(key(e.at));
            expect(reached.size).toBe(ROWS * COLS - 3);
        });

        it('gives dijkstra a finite cheapest cost', () => {
            seedRandom(9);
            const grid = weightedGrid();
            expect(runToPath(dijkstra(grid)).path.cost).toBe(referenceCost(grid));
        });
    });
});
