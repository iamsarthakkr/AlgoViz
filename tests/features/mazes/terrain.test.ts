import { describe, expect, it } from 'vitest';
import { dijkstra } from '@/features/algo/dijkstra';
import { prims } from '@/features/mazes/prims';
import { terrainGenerator } from '@/features/mazes/terrain';
import { CellKind, Coord } from '@/types/grid';
import { MazeGeneratorEvent, WeightEvent } from '@/types/mazeGenerator';
import { distance } from '@/utils/coord';
import { DEFAULT_WEIGHT, WEIGHT_LEVELS } from '@/utils/constants';
import { applyMazeEvents, emptyGrid, referenceCost, runMaze, runToPath } from '../../helpers/grid';
import { fixRandom, seedRandom } from '../../helpers/random';

const [LIGHT, MEDIUM, HEAVY] = WEIGHT_LEVELS;
const MIN_RADIUS = 3;
const MAX_RADIUS = 6;

// 144 cells: one seed per 100 cells, so exactly one blob
const ONE_BLOB = 12;
// 400 cells: 4 blobs, enough to overlap
const MANY_BLOBS = 20;

const isWeight = (e: MazeGeneratorEvent): e is WeightEvent => e.type === 'weight';
const key = (at: Coord, cols: number) => at.r * cols + at.c;

// what the store ends up with: the last write to each cell
const finalWeights = (events: MazeGeneratorEvent[], cols: number) =>
    new Map(events.filter(isWeight).map((e) => [key(e.at, cols), e.w]));

// the blob a seed and radius should give on an open board
function expectedBlob(seed: Coord, radius: number, size: number) {
    const blob = new Map<number, number>();
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const d = distance({ r, c }, seed);
            if (d > radius) continue;
            const t = d / radius;
            blob.set(key({ r, c }, size), t > 2 / 3 ? LIGHT : t > 1 / 3 ? MEDIUM : HEAVY);
        }
    }
    return blob;
}

describe('terrain blobs', () => {
    describe('one blob', () => {
        // 0 rolls the smallest radius, 0.999 the largest
        const CASES = [
            ['smallest', 0, MIN_RADIUS],
            ['largest', 0.999, MAX_RADIUS],
        ] as const;

        it.each(CASES)('starts at a heavy centre (%s radius)', (_name, roll) => {
            fixRandom(roll);
            const first = runMaze(terrainGenerator, ONE_BLOB, ONE_BLOB).filter(isWeight)[0];
            expect(first.w).toBe(HEAVY);
        });

        it.each(CASES)('fills the whole circle, heavy to light (%s radius)', (_name, roll, radius) => {
            fixRandom(roll);
            const events = runMaze(terrainGenerator, ONE_BLOB, ONE_BLOB);
            const seed = events.filter(isWeight)[0].at;
            expect(finalWeights(events, ONE_BLOB)).toEqual(expectedBlob(seed, radius, ONE_BLOB));
        });

        // the choice that makes blobs round: Manhattan distance would stop short of this cell
        it('reaches diagonally further than a diamond would', () => {
            fixRandom(0.999);
            const events = runMaze(terrainGenerator, ONE_BLOB, ONE_BLOB);
            const seed = events.filter(isWeight)[0].at;
            const diagonal = { r: seed.r + 4, c: seed.c + 4 };
            expect(distance(diagonal, seed)).toBeLessThanOrEqual(MAX_RADIUS);
            expect(finalWeights(events, ONE_BLOB).has(key(diagonal, ONE_BLOB))).toBe(true);
        });

        it('stays within the largest radius of its seed', () => {
            for (let seed = 1; seed <= 20; seed++) {
                seedRandom(seed);
                const [first, ...rest] = runMaze(terrainGenerator, ONE_BLOB, ONE_BLOB).filter(isWeight);
                for (const e of rest) expect(distance(e.at, first.at)).toBeLessThanOrEqual(MAX_RADIUS);
            }
        });
    });

    describe('around walls', () => {
        it('does not spread past a wall, even when the far side is in range', () => {
            const WALL_COL = 3;
            const cells = Array.from({ length: ONE_BLOB * ONE_BLOB }, (_, i) =>
                i % ONE_BLOB === WALL_COL ? CellKind.wall : CellKind.empty,
            );
            fixRandom(0.999); // no shuffle swaps, so the seed is the first open cell, left of the wall
            for (const e of runMaze(terrainGenerator, ONE_BLOB, ONE_BLOB, cells).filter(isWeight)) {
                expect(e.at.c).toBeLessThan(WALL_COL);
            }
        });

        // regression: seeds were retried until enough open cells turned up, which froze the tab
        it('finishes when there are fewer open cells than seeds', () => {
            seedRandom(1);
            const cells = Array<CellKind>(MANY_BLOBS * MANY_BLOBS).fill(CellKind.wall);
            cells[key({ r: 5, c: 5 }, MANY_BLOBS)] = CellKind.empty;
            cells[key({ r: 9, c: 9 }, MANY_BLOBS)] = CellKind.empty;
            const placed = runMaze(terrainGenerator, MANY_BLOBS, MANY_BLOBS, cells).filter(isWeight);
            expect(placed.map((e) => e.w)).toEqual([HEAVY, HEAVY]);
        });

        it('places nothing on a board of walls', () => {
            const walls = Array<CellKind>(MANY_BLOBS * MANY_BLOBS).fill(CellKind.wall);
            const events = runMaze(terrainGenerator, MANY_BLOBS, MANY_BLOBS, walls);
            expect(events.map((e) => e.type)).toEqual(['clear-weights', 'done']);
        });
    });

    describe('overlapping blobs', () => {
        // only raising a cell, and only once per level, keeps a heavy centre safe and the run short
        it('only ever raises a cell, so a light rim cannot overwrite a heavy centre', () => {
            for (let seed = 1; seed <= 20; seed++) {
                seedRandom(seed);
                const last = new Map<number, number>();
                for (const e of runMaze(terrainGenerator, MANY_BLOBS, MANY_BLOBS).filter(isWeight)) {
                    const id = key(e.at, MANY_BLOBS);
                    expect(e.w).toBeGreaterThan(last.get(id) ?? 0);
                    last.set(id, e.w);
                }
            }
        });
    });

    it('builds on a maze, and dijkstra still finds the cheapest path', () => {
        const SIZE = 21;
        seedRandom(6);
        const cells = applyMazeEvents(SIZE, SIZE, runMaze(prims, SIZE, SIZE));
        const open = cells.flatMap((k, i) => (k === CellKind.empty ? [i] : []));
        const coord = (i: number) => ({ r: Math.floor(i / SIZE), c: i % SIZE });
        const grid = emptyGrid(SIZE, SIZE, coord(open[0]), coord(open[open.length - 1]));
        grid.cells = cells;
        for (const e of runMaze(terrainGenerator, SIZE, SIZE, cells).filter(isWeight)) {
            grid.weights[key(e.at, SIZE)] = e.w;
        }
        grid.weights[open[0]] = DEFAULT_WEIGHT;
        grid.weights[open[open.length - 1]] = DEFAULT_WEIGHT;
        expect(runToPath(dijkstra(grid)).path.cost).toBe(referenceCost(grid));
    });
});
