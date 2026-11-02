import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMazeGenerator } from '@/features/animations/useMazeGenerator';
import { getGridSnapshot } from '@/features/animations/utils';
import { bfs } from '@/features/algo/bfs';
import { dijkstra } from '@/features/algo/dijkstra';
import { useGridStore } from '@/features/store';
import { CellKind } from '@/types/grid';
import { mazeMap, mazeRegistry } from '@/features/mazes';
import { MazeGenerator } from '@/types/mazeGenerator';
import { DEFAULT_WEIGHT, WEIGHT_LEVELS } from '@/utils/constants';
import { installFakeRaf } from '../../helpers/raf';
import { fixRandom, seedRandom } from '../../helpers/random';
import { runToPath } from '../../helpers/grid';

// Deterministic generator exercising every event type
const scripted: MazeGenerator = function* () {
    yield { type: 'fill-wall' };
    yield { type: 'carve', at: { r: 1, c: 1 } };
    yield { type: 'clear-wall' };
    yield { type: 'wall', at: { r: 0, c: 0 } };
    yield { type: 'wall', at: { r: 0, c: 1 } };
    yield { type: 'done' };
};

const api = () => useGridStore.getState();
const noWeights = () => api().weights.every((w) => w === DEFAULT_WEIGHT);
const WALL_MAZES = mazeRegistry.filter((e) => e.group === 'Mazes').map((e) => e.label);
const WEIGHTED_MAZE = 'Weighted Maze';

describe('useMazeGenerator', () => {
    let raf: ReturnType<typeof installFakeRaf>;
    beforeEach(() => {
        raf = installFakeRaf();
        api().reset(5, 5);
        api().setStart(2, 1);
        api().setGoal(2, 3);
    });

    const render = () => renderHook(() => useMazeGenerator({ scripted }, { speed: 60 }));

    it('locks the grid and hides the markers while generating', () => {
        const { result } = render();
        act(() => result.current.generate('scripted'));
        expect(api().gridLock).toBe(true);
        expect(api().markersHidden).toBe(true);
    });

    it('writes each event into the grid store', () => {
        const { result } = render();
        act(() => result.current.generate('scripted'));
        raf.frame(); // fill-wall
        expect(api().cells.every((k) => k === CellKind.wall)).toBe(true);
        raf.frame(); // carve
        expect(api().at(1, 1)).toBe(CellKind.empty);
        raf.frame(); // clear-wall
        raf.frame(); // wall
        raf.frame(); // wall
        expect(api().at(0, 0)).toBe(CellKind.wall);
        expect(api().at(0, 1)).toBe(CellKind.wall);
        expect(api().at(4, 4)).toBe(CellKind.empty);
    });

    it('restores the markers, unlocks and bumps gridVersion when done', () => {
        const { result } = render();
        const version = api().gridVersion;
        act(() => result.current.generate('scripted'));
        raf.flush();
        expect(api().start).toEqual({ r: 2, c: 1 });
        expect(api().goal).toEqual({ r: 2, c: 3 });
        expect(api().gridLock).toBe(false);
        expect(api().gridVersion).toBe(version + 1);
    });

    it('starting a new maze mid-run cancels the old one and restores markers first', () => {
        const { result } = render();
        act(() => result.current.generate('scripted'));
        raf.frame();
        act(() => result.current.generate('scripted'));
        raf.flush();
        expect(api().start).toEqual({ r: 2, c: 1 });
        expect(api().goal).toEqual({ r: 2, c: 3 });
        expect(api().gridLock).toBe(false);
    });

    it('ignores unknown generator keys', () => {
        const { result } = render();
        act(() => result.current.generate('missing'));
        expect(api().gridLock).toBe(false);
        expect(raf.pending()).toBe(0);
    });

    it('does nothing while the markers are hidden', () => {
        api().hideMarkers();
        const { result } = render();
        act(() => result.current.generate('scripted'));
        expect(api().gridLock).toBe(false);
    });

    // Markers keep their coordinates while hidden, but a maze must behave as if they weren't there, and
    // when it ends they must land on open cells, or the goal can't be reached and every run says "No path"
    describe('markers and the finished maze', () => {
        const generate = (gen: MazeGenerator) => {
            const { result } = renderHook(() => useMazeGenerator({ gen }, { speed: 60 }));
            act(() => result.current.generate('gen'));
            act(() => void raf.flush());
        };
        const isOpen = ({ r, c }: { r: number; c: number }) => api().at(r, c) === CellKind.empty;

        it('shows the markers again when done', () => {
            generate(scripted);
            expect(api().markersHidden).toBe(false);
        });

        it('draws maze walls through the hidden markers cells', () => {
            const { start } = api();
            generate(function* () {
                yield { type: 'clear-wall' };
                yield { type: 'wall', at: start };
                yield { type: 'done' };
            });
            expect(api().at(start.r, start.c)).toBe(CellKind.wall);
        });

        it('moves a marker walled over by the maze to the nearest open cell', () => {
            generate(function* () {
                yield { type: 'fill-wall' };
                yield { type: 'carve', at: { r: 1, c: 1 } }; // beside the start
                yield { type: 'carve', at: { r: 1, c: 3 } }; // beside the goal
                yield { type: 'done' };
            });
            expect(api().start).toEqual({ r: 1, c: 1 });
            expect(api().goal).toEqual({ r: 1, c: 3 });
        });

        // both markers' nearest open cell is (2,2): the goal must not be left on a wall or on the start
        it('keeps the markers apart when they would land on the same cell', () => {
            generate(function* () {
                yield { type: 'fill-wall' };
                yield { type: 'carve', at: { r: 2, c: 2 } };
                yield { type: 'carve', at: { r: 0, c: 0 } };
                yield { type: 'done' };
            });
            const { start, goal } = api();
            expect(isOpen(start) && isOpen(goal)).toBe(true);
            expect(start).not.toEqual(goal);
        });

        // even coordinates: the lattice mazes keep walls there, so a marker dragged onto one gets walled over
        it.each(WALL_MAZES)('leaves both markers on open cells after %s', (key) => {
            seedRandom(7);
            api().reset(15, 21);
            api().setStart(2, 2);
            api().setGoal(12, 18);
            const { result } = renderHook(() => useMazeGenerator(mazeMap, { speed: 6000 }));
            act(() => result.current.generate(key));
            act(() => void raf.flush());
            expect(isOpen(api().start)).toBe(true);
            expect(isOpen(api().goal)).toBe(true);
            expect(api().start).not.toEqual(api().goal);
        });

        // Decision: a wall maze is a fresh board. Only fillWalls drops weights by itself, so a maze
        // starting with clear-wall must also yield clear-weights.
        it.each(WALL_MAZES.filter((key) => key !== WEIGHTED_MAZE))('%s starts from a board with no weights', (key) => {
            seedRandom(7);
            api().reset(15, 21);
            api().setWeight(1, 1, WEIGHT_LEVELS[0]);
            api().setWeight(2, 2, WEIGHT_LEVELS[2]);
            const { result } = renderHook(() => useMazeGenerator(mazeMap, { speed: 6000 }));
            act(() => result.current.generate(key));
            act(() => void raf.flush());
            expect(noWeights()).toBe(true);
        });
    });

    describe('weight events', () => {
        it('writes weight and clear-weights into the store', () => {
            const gen: MazeGenerator = function* () {
                yield { type: 'weight', at: { r: 1, c: 1 }, w: WEIGHT_LEVELS[1] };
                yield { type: 'clear-weights' };
                yield { type: 'done' };
            };
            const { result } = renderHook(() => useMazeGenerator({ gen }, { speed: 60 }));
            act(() => result.current.generate('gen'));
            raf.frame();
            expect(api().weightAt(1, 1)).toBe(WEIGHT_LEVELS[1]);
            raf.frame();
            expect(noWeights()).toBe(true);
        });

        // clear-wall used to wipe weights in the hook, which would make Clear walls drop terrain
        it('leaves weights alone on clear-wall', () => {
            api().setWeight(1, 1, WEIGHT_LEVELS[2]);
            const gen: MazeGenerator = function* () {
                yield { type: 'clear-wall' };
                yield { type: 'done' };
            };
            const { result } = renderHook(() => useMazeGenerator({ gen }, { speed: 60 }));
            act(() => result.current.generate('gen'));
            act(() => void raf.flush());
            expect(api().weightAt(1, 1)).toBe(WEIGHT_LEVELS[2]);
        });
    });

    // a generator chained after another must see the walls the first one built
    it('gives generators the live board, not a copy from the start', () => {
        const seen: CellKind[] = [];
        const gen: MazeGenerator = function* (_rows, _cols, getCells) {
            yield { type: 'wall', at: { r: 1, c: 1 } };
            seen.push(getCells()[api().idx(1, 1)]);
            yield { type: 'done' };
        };
        const { result } = renderHook(() => useMazeGenerator({ gen }, { speed: 60 }));
        act(() => result.current.generate('gen'));
        act(() => void raf.flush());
        expect(seen).toEqual([CellKind.wall]);
    });

    describe('Random Weights', () => {
        const run = () => {
            const { result } = renderHook(() => useMazeGenerator(mazeMap, { speed: 6000 }));
            act(() => result.current.generate('Random Weights'));
            act(() => void raf.flush());
        };

        it('keeps the walls and replaces the old weights', () => {
            api().setWall(0, 0);
            api().setWeight(1, 1, WEIGHT_LEVELS[2]);
            fixRandom(0.99); // no coin flip lands, so only the reset shows
            run();
            expect(api().at(0, 0)).toBe(CellKind.wall);
            expect(noWeights()).toBe(true);
        });

        it('weights every plain cell it lands on, but not walls or marker cells', () => {
            api().setWall(0, 0);
            fixRandom(0);
            run();
            const { start, goal } = api();
            expect(api().weightAt(0, 0)).toBe(DEFAULT_WEIGHT);
            expect(api().weightAt(start.r, start.c)).toBe(DEFAULT_WEIGHT);
            expect(api().weightAt(goal.r, goal.c)).toBe(DEFAULT_WEIGHT);
            const unweighted = api().weights.filter((w) => w === DEFAULT_WEIGHT);
            expect(unweighted).toHaveLength(3);
        });

        it('leaves only level values in the store', () => {
            seedRandom(3);
            run();
            for (const w of api().weights) expect([DEFAULT_WEIGHT, ...WEIGHT_LEVELS]).toContain(w);
        });

        it('gives the board back when done', () => {
            seedRandom(3);
            run();
            expect(api().gridLock).toBe(false);
            expect(api().markersHidden).toBe(false);
        });
    });

    describe('Add Loops', () => {
        const ROWS = 15;
        const COLS = 21;

        // a Prim's maze from the real registry, then loops on top of it
        const build = () => {
            seedRandom(5);
            api().reset(ROWS, COLS);
            const { result } = renderHook(() => useMazeGenerator(mazeMap, { speed: 6000 }));
            act(() => result.current.generate("Prim's"));
            act(() => void raf.flush());
            return result;
        };
        const walls = () => api().cells.filter((k) => k === CellKind.wall).length;

        it('opens walls on the live board and gives it back', () => {
            const result = build();
            const before = walls();
            act(() => result.current.generate('Add Loops'));
            act(() => void raf.flush());
            expect(walls()).toBeLessThan(before);
            expect(api().gridLock).toBe(false);
            expect(api().markersHidden).toBe(false);
        });

        it('keeps the terrain', () => {
            const result = build();
            const cell = api().cells.indexOf(CellKind.empty, COLS + 1);
            const r = Math.floor(cell / COLS);
            const c = cell % COLS;
            expect(api().setWeight(r, c, WEIGHT_LEVELS[2])).toBe(true);
            act(() => result.current.generate('Add Loops'));
            act(() => void raf.flush());
            expect(api().weightAt(r, c)).toBe(WEIGHT_LEVELS[2]);
        });
    });

    describe('Weighted Maze', () => {
        const ROWS = 15;
        const COLS = 21;
        const run = (seed: number, speed = 6000) => {
            seedRandom(seed);
            api().reset(ROWS, COLS);
            const { result } = renderHook(() => useMazeGenerator(mazeMap, { speed }));
            act(() => result.current.generate(WEIGHTED_MAZE));
            return result;
        };
        const finish = () => act(() => void raf.flush());

        it('wipes the old terrain before building', () => {
            run(2, 60);
            api().setWeight(1, 1, WEIGHT_LEVELS[2]);
            raf.frame(); // fill-wall
            expect(noWeights()).toBe(true);
        });

        it('ends with walls and weights, and gives the board back', () => {
            run(2);
            finish();
            expect(api().cells).toContain(CellKind.wall);
            expect(noWeights()).toBe(false);
            expect(api().gridLock).toBe(false);
            expect(api().markersHidden).toBe(false);
        });

        // proves terrain read the finished maze, not the board from before it
        it('only puts level weights on open cells', () => {
            run(2);
            finish();
            api().weights.forEach((w, i) => {
                if (w === DEFAULT_WEIGHT) return;
                expect(WEIGHT_LEVELS).toContain(w);
                expect(api().cells[i]).toBe(CellKind.empty);
            });
        });

        // a perfect maze is a tree, edges = cells - 1: more edges means Add Loops read the live maze
        it('has loops', () => {
            run(2);
            finish();
            const { cells } = api();
            const open = cells.filter((k) => k === CellKind.empty).length;
            let edges = 0;
            cells.forEach((k, i) => {
                if (k !== CellKind.empty) return;
                if ((i + 1) % COLS !== 0 && cells[i + 1] === CellKind.empty) edges++;
                if (i + COLS < cells.length && cells[i + COLS] === CellKind.empty) edges++;
            });
            expect(edges).toBeGreaterThan(open - 1);
        });

        it('gives dijkstra a cheaper route than bfs, the point of the preset', () => {
            let cheaper = 0;
            for (let seed = 1; seed <= 10; seed++) {
                run(seed);
                finish();
                const snap = getGridSnapshot()!;
                const best = runToPath(dijkstra(snap)).path.cost;
                const shortest = runToPath(bfs(snap)).path.cost;
                expect(best).toBeLessThanOrEqual(shortest);
                if (best < shortest) cheaper++;
            }
            expect(cheaper).toBeGreaterThan(0);
        });

        it('stops wherever it is when a Clear is picked', () => {
            const result = run(2, 60);
            for (let i = 0; i < 5; i++) raf.frame();
            act(() => result.current.generate('Clear Board'));
            finish();
            expect(api().cells).not.toContain(CellKind.wall);
            expect(noWeights()).toBe(true);
            expect(api().gridLock).toBe(false);
            expect(api().markersHidden).toBe(false);
        });
    });

    describe('Clear actions', () => {
        const run = (key: string) => {
            const { result } = renderHook(() => useMazeGenerator(mazeMap, { speed: 60 }));
            act(() => result.current.generate(key));
            return result;
        };

        beforeEach(() => {
            api().setWall(0, 0);
            api().setWeight(1, 1, WEIGHT_LEVELS[0]);
        });

        it.each([
            ['Clear Walls', CellKind.empty, WEIGHT_LEVELS[0]],
            ['Clear Weights', CellKind.wall, DEFAULT_WEIGHT],
            ['Clear Board', CellKind.empty, DEFAULT_WEIGHT],
        ])('%s clears only its own layer', (key, cell, weight) => {
            run(key);
            act(() => void raf.flush());
            expect(api().at(0, 0)).toBe(cell);
            expect(api().weightAt(1, 1)).toBe(weight);
            expect(api().gridLock).toBe(false);
            expect(api().markersHidden).toBe(false);
        });

        it('stops a running maze and gives the board back', () => {
            seedRandom(7);
            api().reset(15, 21);
            const result = run(WALL_MAZES[0]);
            for (let i = 0; i < 5; i++) raf.frame();
            expect(api().cells).toContain(CellKind.wall);

            act(() => result.current.generate('Clear Walls'));
            act(() => void raf.flush());
            expect(api().cells).not.toContain(CellKind.wall);
            expect(api().gridLock).toBe(false);
            expect(api().markersHidden).toBe(false);
        });

        it('leaves the generator usable for the next run', () => {
            seedRandom(7);
            api().reset(15, 21);
            const result = run('Clear Board');
            act(() => void raf.flush());
            act(() => result.current.generate(WALL_MAZES[0]));
            act(() => void raf.flush());
            expect(api().cells).toContain(CellKind.wall);
        });
    });
});
