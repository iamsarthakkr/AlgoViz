import { describe, expect, it } from 'vitest';
import { bfs } from '@/features/algo/bfs';
import { dijkstra } from '@/features/algo/dijkstra';
import { floodFill } from '@/features/mazes/floodFill';
import { loopsGenerator } from '@/features/mazes/loops';
import { prims } from '@/features/mazes/prims';
import { recursiveDivision } from '@/features/mazes/recursiveDivision';
import { terrainGenerator } from '@/features/mazes/terrain';
import { CellKind, Coord } from '@/types/grid';
import { CarveEvent, MazeGenerator, MazeGeneratorEvent } from '@/types/mazeGenerator';
import { DEFAULT_WEIGHT } from '@/utils/constants';
import { applyMazeEvents, countOpen, countReachable, emptyGrid, runMaze, runToPath } from '../../helpers/grid';
import { seedRandom } from '../../helpers/random';

const ROWS = 21;
const COLS = 35;
const LOOP_SHARE = 0.12;

const MAZES: [string, MazeGenerator][] = [
    ["Prim's", prims],
    ['Randomized DFS', floodFill],
    ['Recursive Division', recursiveDivision()],
];

const isCarve = (e: MazeGeneratorEvent): e is CarveEvent => e.type === 'carve';
const parse = (picture: string[]) => [...picture.join('')].map((ch) => (ch === '#' ? CellKind.wall : CellKind.empty));
const carvesOn = (picture: string[]) =>
    runMaze(loopsGenerator, picture.length, picture[0].length, parse(picture)).filter(isCarve);

// `count` walls in a row, each between two open cells
const passages = (count: number) => {
    const line = '#.' + '#.'.repeat(count) + '#';
    return ['#'.repeat(line.length), line, '#'.repeat(line.length)];
};
// the same walls, each between two open cells above and below
const transpose = (picture: string[]) => [...picture[0]].map((_, c) => picture.map((line) => line[c]).join(''));

// a board's cells as events, so applyMazeEvents can continue from it
const onTopOf = (cells: CellKind[], cols: number, events: MazeGeneratorEvent[]) =>
    applyMazeEvents(Math.floor(cells.length / cols), cols, [
        { type: 'fill-wall' },
        ...cells.flatMap((k, i) =>
            k === CellKind.empty ? [{ type: 'carve' as const, at: { r: Math.floor(i / cols), c: i % cols } }] : [],
        ),
        ...events,
    ]);

const isWall = (cells: CellKind[], cols: number, { r, c }: Coord) => cells[r * cols + c] === CellKind.wall;

// the rule, written independently of the generator
function isCandidate(cells: CellKind[], rows: number, cols: number, at: Coord) {
    if (at.r < 1 || at.c < 1 || at.r > rows - 2 || at.c > cols - 2 || !isWall(cells, cols, at)) return false;
    const up = isWall(cells, cols, { r: at.r - 1, c: at.c });
    const down = isWall(cells, cols, { r: at.r + 1, c: at.c });
    const left = isWall(cells, cols, { r: at.r, c: at.c - 1 });
    const right = isWall(cells, cols, { r: at.r, c: at.c + 1 });
    return (up && down && !left && !right) || (left && right && !up && !down);
}

function countCandidates(cells: CellKind[], rows: number, cols: number) {
    let count = 0;
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) if (isCandidate(cells, rows, cols, { r, c })) count++;
    }
    return count;
}

describe('add loops', () => {
    it('only carves, and ends with done', () => {
        seedRandom(1);
        const events = runMaze(loopsGenerator, 3, passages(16)[0].length, parse(passages(16)));
        expect(new Set(events.slice(0, -1).map((e) => e.type))).toEqual(new Set(['carve']));
        expect(events.at(-1)).toEqual({ type: 'done' });
    });

    describe('which walls it can open', () => {
        it.each([
            ['left and right', passages(10)],
            ['above and below', transpose(passages(10))],
        ])('a wall with passages %s', (_name, picture) => {
            seedRandom(2);
            expect(carvesOn(picture)).toHaveLength(1);
        });

        // regression: the cell itself wasn't checked, so corridors passed the neighbour test and most
        // carves changed nothing
        it('never picks an open cell, even with walls on two sides', () => {
            const corridor = ['#'.repeat(COLS), '.'.repeat(COLS), '#'.repeat(COLS)];
            expect(carvesOn(corridor)).toEqual([]);
            expect(carvesOn(transpose(corridor))).toEqual([]);
        });

        // three open neighbours: opening it would make a junction room, not a loop
        it('never opens a wall at a junction, or a wall with one passage', () => {
            const JUNCTION = { r: 3, c: 1 };
            const DEAD_END = { r: 3, c: 3 };
            const row = passages(9);
            const width = row[0].length;
            const board = [
                row[0],
                row[1],
                row[1],
                '.' + '#'.repeat(width - 1),
                '...' + '#'.repeat(width - 3),
                '#'.repeat(width),
            ];
            for (let seed = 1; seed <= 50; seed++) {
                seedRandom(seed);
                for (const { at } of carvesOn(board)) {
                    expect(at).not.toEqual(JUNCTION);
                    expect(at).not.toEqual(DEAD_END);
                }
            }
        });

        it('keeps the outer border closed', () => {
            // every border wall sits between two open cells
            const line = '.#'.repeat(10) + '.';
            const board = [line, '.'.repeat(line.length), line];
            for (let seed = 1; seed <= 20; seed++) {
                seedRandom(seed);
                expect(carvesOn(board)).toEqual([]);
            }
        });
    });

    describe('how many it opens', () => {
        // floors the share: 8 candidates are worth 0.96 of a carve
        it.each([
            [8, 0],
            [9, 1],
            [17, 2],
            [50, 6],
        ])('of %i candidates, opens %i', (candidates, carves) => {
            seedRandom(3);
            const picture = passages(candidates);
            expect(countCandidates(parse(picture), picture.length, picture[0].length)).toBe(candidates);
            expect(carves).toBe(Math.floor(LOOP_SHARE * candidates));
            expect(carvesOn(picture)).toHaveLength(carves);
        });

        it('opens a different set on a different seed', () => {
            const picture = passages(50);
            seedRandom(1);
            const first = carvesOn(picture);
            seedRandom(2);
            expect(carvesOn(picture)).not.toEqual(first);
        });
    });

    it('does nothing when no wall qualifies', () => {
        const SIZE = 9;
        const open = Array<CellKind>(SIZE * SIZE).fill(CellKind.empty);
        const walls = Array<CellKind>(SIZE * SIZE).fill(CellKind.wall);
        expect(runMaze(loopsGenerator, SIZE, SIZE, open)).toEqual([{ type: 'done' }]);
        expect(runMaze(loopsGenerator, SIZE, SIZE, walls)).toEqual([{ type: 'done' }]);
    });

    it('copes with a grid too small to have an interior', () => {
        expect(runMaze(loopsGenerator, 2, 2)).toEqual([{ type: 'done' }]);
    });

    describe.each(MAZES)('on a %s maze', (_name, maze) => {
        const build = (seed: number) => {
            seedRandom(seed);
            const cells = applyMazeEvents(ROWS, COLS, runMaze(maze, ROWS, COLS));
            const carves = runMaze(loopsGenerator, ROWS, COLS, cells).filter(isCarve);
            return { cells, carves };
        };

        it('opens walls that really are walls, each one once', () => {
            for (let seed = 1; seed <= 20; seed++) {
                const { cells, carves } = build(seed);
                expect(carves.length).toBeGreaterThan(0);
                for (const { at } of carves) expect(isCandidate(cells, ROWS, COLS, at)).toBe(true);
                expect(new Set(carves.map(({ at }) => at.r * COLS + at.c)).size).toBe(carves.length);
            }
        });

        it('opens its share of the candidates', () => {
            const { cells, carves } = build(1);
            expect(carves).toHaveLength(Math.floor(LOOP_SHARE * countCandidates(cells, ROWS, COLS)));
        });

        it('adds exactly one open cell per carve, and strands none', () => {
            const { cells, carves } = build(4);
            const after = onTopOf(cells, COLS, carves);
            expect(countOpen(after)).toBe(countOpen(cells) + carves.length);
            const from = after.indexOf(CellKind.empty);
            const start = { r: Math.floor(from / COLS), c: from % COLS };
            expect(countReachable(ROWS, COLS, after, start)).toBe(countOpen(after));
        });
    });

    // why this generator exists: without loops there's one route, and weights can't change it
    it('lets weights change the route, which a perfect maze cannot', () => {
        const coord = (i: number) => ({ r: Math.floor(i / COLS), c: i % COLS });
        const costs = (cells: CellKind[], seed: number) => {
            const open = cells.flatMap((k, i) => (k === CellKind.empty ? [i] : []));
            const [first, last] = [open[0], open[open.length - 1]];
            const grid = emptyGrid(ROWS, COLS, coord(first), coord(last));
            grid.cells = cells;
            seedRandom(seed);
            for (const e of runMaze(terrainGenerator, ROWS, COLS, cells)) {
                if (e.type === 'weight') grid.weights[e.at.r * COLS + e.at.c] = e.w;
            }
            grid.weights[first] = DEFAULT_WEIGHT;
            grid.weights[last] = DEFAULT_WEIGHT;
            return { dijkstra: runToPath(dijkstra(grid)).path.cost, bfs: runToPath(bfs(grid)).path.cost };
        };

        seedRandom(8);
        const perfect = applyMazeEvents(ROWS, COLS, runMaze(prims, ROWS, COLS));
        const before = costs(perfect, 8);
        expect(before.dijkstra).toBe(before.bfs);

        let cheaper = 0;
        for (let seed = 1; seed <= 10; seed++) {
            seedRandom(seed);
            const looped = onTopOf(perfect, COLS, runMaze(loopsGenerator, ROWS, COLS, perfect));
            const { dijkstra: best, bfs: shortest } = costs(looped, seed);
            expect(best).toBeLessThanOrEqual(shortest);
            if (best < shortest) cheaper++;
        }
        expect(cheaper).toBeGreaterThan(0);
    });
});
