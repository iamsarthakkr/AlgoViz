import { describe, expect, it, vi } from 'vitest';
import { useGridStore } from '@/features/store';
import { CellKind } from '@/types/grid';
import {
    CELL_SIZE,
    COL_PRESETS,
    COLS,
    DEFAULT_WEIGHT,
    MAX_CELL,
    MIN_CELL,
    MIN_ROWS,
    ROWS,
    WEIGHT_LEVELS,
} from '@/utils/constants';
import { initGrid } from '@/utils/grid';

const api = () => useGridStore.getState();

describe('useGridStore', () => {
    it('starts with the default grid', () => {
        expect(api().rows).toBe(ROWS);
        expect(api().cols).toBe(COLS);
        expect(api().markersHidden).toBe(false);
    });

    it('idx / inBounds / at use row-major indexing', () => {
        expect(api().idx(2, 3)).toBe(2 * COLS + 3);
        expect(api().inBounds(0, 0)).toBe(true);
        expect(api().inBounds(ROWS, 0)).toBe(false);
        expect(api().inBounds(0, -1)).toBe(false);
        api().setWall(2, 3);
        expect(api().at(2, 3)).toBe(CellKind.wall);
    });

    describe('walls', () => {
        it('setWall sets a wall and replaces the cells array (so subscribers re-render)', () => {
            const before = api().cells;
            api().setWall(0, 0);
            expect(api().cells).not.toBe(before);
            expect(api().at(0, 0)).toBe(CellKind.wall);
        });

        it('clearWall turns a wall back into an empty cell', () => {
            api().setWall(0, 0);
            api().clearWall(0, 0);
            expect(api().at(0, 0)).toBe(CellKind.empty);
        });

        it('ignores out-of-bounds cells', () => {
            const before = api().cells;
            api().setWall(-1, 0);
            api().setWall(0, COLS);
            api().clearWall(ROWS, 0);
            expect(api().cells).toBe(before);
        });

        it('never puts a wall on the start or goal cell', () => {
            const { start, goal } = api();
            api().setWall(start.r, start.c);
            api().setWall(goal.r, goal.c);
            expect(api().at(start.r, start.c)).toBe(CellKind.empty);
            expect(api().at(goal.r, goal.c)).toBe(CellKind.empty);
        });

        it('skips the update when there is nothing to change', () => {
            api().setWall(0, 0);
            const walled = api().cells;
            api().setWall(0, 0);
            expect(api().cells).toBe(walled);

            api().clearWall(1, 1); // already empty
            expect(api().cells).toBe(walled);
        });

        it('fillWalls / clearWalls change every cell', () => {
            api().fillWalls();
            expect(api().cells.every((k) => k === CellKind.wall)).toBe(true);
            api().clearWalls();
            expect(api().cells.every((k) => k === CellKind.empty)).toBe(true);
        });
    });

    // The rule: only plain cells carry weight. A wall never has one; the markers' cells can hold one
    // (a marker dropped on terrain), but it never counts (see getGridSnapshot).
    describe('weights', () => {
        const [LIGHT, MEDIUM, HEAVY] = WEIGHT_LEVELS;
        const weightAt = (r: number, c: number) => api().weights[api().idx(r, c)];

        it('a new grid has every cell at the default weight', () => {
            expect(api().weights).toHaveLength(ROWS * COLS);
            expect(api().weights.every((w) => w === DEFAULT_WEIGHT)).toBe(true);
        });

        it('setWeight sets a weight and replaces the weights array', () => {
            const before = api().weights;
            api().setWeight(0, 0, MEDIUM);
            expect(api().weights).not.toBe(before);
            expect(weightAt(0, 0)).toBe(MEDIUM);
        });

        it('setWeight skips out-of-bounds cells, walls and unchanged values', () => {
            api().setWall(1, 1);
            api().setWeight(0, 0, LIGHT);
            const before = api().weights;

            api().setWeight(-1, 0, LIGHT);
            api().setWeight(0, COLS, LIGHT);
            api().setWeight(1, 1, LIGHT); // wall
            api().setWeight(0, 0, LIGHT); // unchanged
            expect(api().weights).toBe(before);
        });

        // a weight below the default would make a step cheaper than an open cell, which breaks the
        // assumption A* relies on (every step costs at least DEFAULT_WEIGHT)
        it('setWeight refuses weights below the default', () => {
            const before = api().weights;
            api().setWeight(0, 0, DEFAULT_WEIGHT / 2);
            api().setWeight(0, 0, 0);
            expect(api().weights).toBe(before);
        });

        it('setWeight never paints the start or goal cell', () => {
            const { start, goal } = api();
            api().setWeight(start.r, start.c, HEAVY);
            api().setWeight(goal.r, goal.c, HEAVY);
            expect(weightAt(start.r, start.c)).toBe(DEFAULT_WEIGHT);
            expect(weightAt(goal.r, goal.c)).toBe(DEFAULT_WEIGHT);
        });

        it('clearWeight resets one cell, and skips cells already at the default', () => {
            api().setWeight(0, 0, HEAVY);
            api().clearWeight(0, 0);
            expect(weightAt(0, 0)).toBe(DEFAULT_WEIGHT);

            const before = api().weights;
            api().clearWeight(0, 0);
            expect(api().weights).toBe(before);
        });

        it('clearWeights resets every cell, and skips the update when nothing was weighted', () => {
            api().setWeight(0, 0, LIGHT);
            api().setWeight(1, 1, HEAVY);
            api().clearWeights();
            expect(api().weights.every((w) => w === DEFAULT_WEIGHT)).toBe(true);

            const before = api().weights;
            api().clearWeights();
            expect(api().weights).toBe(before);
        });

        it('a wall drops the weight of its cell', () => {
            api().setWeight(0, 0, HEAVY);
            api().setWall(0, 0);
            expect(weightAt(0, 0)).toBe(DEFAULT_WEIGHT);
            api().clearWall(0, 0);
            expect(weightAt(0, 0)).toBe(DEFAULT_WEIGHT); // the terrain doesn't come back
        });

        it('fillWalls drops every weight (every cell is a wall)', () => {
            api().setWeight(0, 0, HEAVY);
            api().fillWalls();
            expect(api().weights.every((w) => w === DEFAULT_WEIGHT)).toBe(true);
        });

        // "Clear walls" must not wipe terrain the user painted
        it('clearWalls keeps the weights', () => {
            api().setWeight(0, 0, MEDIUM);
            api().setWall(1, 1);
            api().clearWalls();
            expect(weightAt(0, 0)).toBe(MEDIUM);
        });

        // dragging a marker across terrain must not leave holes in it
        it('a marker dropped on a weighted cell keeps the weight stored, so the terrain is back once it leaves', () => {
            const { start } = api();
            const cell = { r: start.r, c: start.c + 2 };
            api().setWeight(cell.r, cell.c, HEAVY);
            api().setStart(cell.r, cell.c);
            expect(api().start).toEqual(cell);
            expect(weightAt(cell.r, cell.c)).toBe(HEAVY);

            api().setStart(start.r, start.c);
            expect(weightAt(cell.r, cell.c)).toBe(HEAVY);
        });

        it('reset gives a fresh grid default weights', () => {
            api().setWeight(0, 0, HEAVY);
            api().reset(MIN_ROWS, COL_PRESETS[0], MIN_CELL);
            expect(api().weights).toHaveLength(MIN_ROWS * COL_PRESETS[0]);
            expect(api().weights.every((w) => w === DEFAULT_WEIGHT)).toBe(true);
        });

        it('resize keeps the weights', () => {
            api().setWeight(0, 0, MEDIUM);
            const { weights } = api();
            api().resize(CELL_SIZE + 1);
            expect(api().weights).toBe(weights);
        });
    });

    // Mutators report whether they changed anything, and skip `set` when they didn't. Callers use the
    // result to refresh (bump gridVersion) only on real changes: a bump re-renders and makes the
    // controller re-solve a finished run, and pointermove fires many times per cell.
    describe('mutators report changes, and a no-op notifies nobody', () => {
        const [LIGHT, MEDIUM] = WEIGHT_LEVELS;

        // runs the mutator and records whether subscribers were notified
        function track(mutate: () => boolean) {
            const listener = vi.fn();
            const unsubscribe = useGridStore.subscribe(listener);
            const result = mutate();
            unsubscribe();
            return { result, notified: listener.mock.calls.length > 0 };
        }
        const changed = { result: true, notified: true };
        const noop = { result: false, notified: false };

        it('setWall / clearWall', () => {
            expect(track(() => api().setWall(0, 0))).toEqual(changed);
            expect(track(() => api().setWall(0, 0))).toEqual(noop);
            expect(track(() => api().clearWall(0, 0))).toEqual(changed);
            expect(track(() => api().clearWall(0, 0))).toEqual(noop);
            expect(track(() => api().setWall(-1, 0))).toEqual(noop);
        });

        it('fillWalls / clearWalls', () => {
            expect(track(() => api().clearWalls())).toEqual(noop); // nothing to clear yet
            expect(track(() => api().fillWalls())).toEqual(changed);
            expect(track(() => api().fillWalls())).toEqual(noop);
            expect(track(() => api().clearWalls())).toEqual(changed);
        });

        it('setWeight / clearWeight / clearWeights', () => {
            expect(track(() => api().clearWeights())).toEqual(noop); // nothing weighted yet
            expect(track(() => api().setWeight(0, 0, LIGHT))).toEqual(changed);
            expect(track(() => api().setWeight(0, 0, LIGHT))).toEqual(noop);
            expect(track(() => api().setWeight(0, 0, MEDIUM))).toEqual(changed); // a different level
            expect(track(() => api().clearWeight(0, 0))).toEqual(changed);
            expect(track(() => api().clearWeight(0, 0))).toEqual(noop);
            api().setWeight(1, 1, LIGHT);
            expect(track(() => api().clearWeights())).toEqual(changed);
        });

        it('setStart / setGoal: a move changes, staying on the same cell does not', () => {
            const { start, goal } = api();
            expect(track(() => api().setStart(start.r, start.c))).toEqual(noop);
            expect(track(() => api().setGoal(goal.r, goal.c))).toEqual(noop);
            expect(track(() => api().setStart(start.r + 1, start.c))).toEqual(changed);
            expect(track(() => api().setGoal(goal.r + 1, goal.c))).toEqual(changed);
        });

        it('setStart / setGoal refuse the other marker’s cell', () => {
            const { start, goal } = api();
            expect(track(() => api().setStart(goal.r, goal.c))).toEqual(noop);
            expect(track(() => api().setGoal(start.r, start.c))).toEqual(noop);
        });

        it('hideMarkers / showMarkers', () => {
            expect(track(() => api().showMarkers())).toEqual(noop); // already shown
            expect(track(() => api().hideMarkers())).toEqual(changed);
            expect(track(() => api().hideMarkers())).toEqual(noop);
            expect(track(() => api().showMarkers())).toEqual(changed);
        });
    });

    it('weightAt reads a cell’s weight', () => {
        api().setWeight(3, 4, WEIGHT_LEVELS[1]);
        expect(api().weightAt(3, 4)).toBe(WEIGHT_LEVELS[1]);
        expect(api().weightAt(0, 0)).toBe(DEFAULT_WEIGHT);
    });

    describe('setStart / setGoal', () => {
        it('moves the marker', () => {
            api().setStart(1, 1);
            api().setGoal(2, 2);
            expect(api().start).toEqual({ r: 1, c: 1 });
            expect(api().goal).toEqual({ r: 2, c: 2 });
        });

        it('clamps to the grid', () => {
            api().setStart(-5, 2);
            expect(api().start).toEqual({ r: 0, c: 2 });
            api().setGoal(ROWS + 10, COLS + 10);
            expect(api().goal).toEqual({ r: ROWS - 1, c: COLS - 1 });
        });

        it('snaps off a wall to the nearest empty cell', () => {
            api().setWall(4, 4);
            api().setStart(4, 4);
            const { start } = api();
            expect(Math.abs(start.r - 4) + Math.abs(start.c - 4)).toBe(1);
        });

        it('refuses to put start on top of goal and vice versa', () => {
            const { start, goal } = api();
            api().setStart(goal.r, goal.c);
            expect(api().start).toEqual(start);
            api().setGoal(start.r, start.c);
            expect(api().goal).toEqual(goal);
        });

        // regression: the hide check used to be `r < 0 && c <= 0`, so dragging a marker above the top edge
        // in the first column (pointer capture keeps sending moves, hitCell gives r = -1) made it vanish
        it('clamps a drag above the top edge in the first column instead of hiding the marker', () => {
            api().setStart(-1, 0);
            expect(api().start).toEqual({ r: 0, c: 0 });
        });

        // moving and hiding are separate actions now, so no coordinate can hide a marker
        it('off-grid coordinates always clamp', () => {
            api().setStart(-1, -1);
            expect(api().start).toEqual({ r: 0, c: 0 });
            expect(api().markersHidden).toBe(false);
        });

        it('hiding keeps the positions, so showing restores them', () => {
            const { start, goal } = api();
            api().hideMarkers();
            expect(api().markersHidden).toBe(true);
            expect(api()).toMatchObject({ start, goal });
            api().showMarkers();
            expect(api().markersHidden).toBe(false);
            expect(api()).toMatchObject({ start, goal });
        });
    });

    describe('reset', () => {
        const layout = { rows: MIN_ROWS, cols: COL_PRESETS[0], cellSize: MIN_CELL };
        const resetTo = () => api().reset(layout.rows, layout.cols, layout.cellSize);

        it('builds an empty grid of the given size', () => {
            api().setWall(0, 0);
            resetTo();
            expect(api()).toMatchObject(layout);
            expect(api().cells).toHaveLength(layout.rows * layout.cols);
            expect(api().cells.every((k) => k === CellKind.empty)).toBe(true);
        });

        it('places start and goal for the new size, as initGrid does', () => {
            api().setStart(0, 0);
            resetTo();
            const expected = initGrid(layout.rows, layout.cols, layout.cellSize);
            expect(api().start).toEqual(expected.start);
            expect(api().goal).toEqual(expected.goal);
        });

        it('restores the default grid when called without a size', () => {
            resetTo();
            api().reset();
            expect(api()).toMatchObject({ rows: ROWS, cols: COLS, cellSize: CELL_SIZE });
        });

        it('releases the grid lock', () => {
            api().setGridLock(true);
            api().reset();
            expect(api().gridLock).toBe(false);
        });

        // runners are cached by the gridVersion they were built from; restarting at 0 would let a
        // runner built for the old grid look current
        it('bumps gridVersion instead of restarting it', () => {
            api().refresh();
            const version = api().gridVersion;
            api().reset();
            expect(api().gridVersion).toBe(version + 1);
        });
    });

    describe('resize', () => {
        const otherSize = CELL_SIZE + 1; // CELL_SIZE is the default, so this always changes it

        it('changes only the cell size: dimensions, walls and markers are kept', () => {
            api().setWall(0, 0);
            const { rows, cols, cells, start, goal } = api();
            api().resize(otherSize);
            expect(api()).toMatchObject({ cellSize: otherSize, rows, cols, cells, start, goal });
        });

        it('bumps gridVersion so a finished run repaints at the new size', () => {
            const version = api().gridVersion;
            api().resize(otherSize);
            expect(api().gridVersion).toBe(version + 1);
        });

        it('is a no-op for the current size', () => {
            const version = api().gridVersion;
            api().resize(api().cellSize);
            expect(api().gridVersion).toBe(version);
        });

        it('clamps to MIN_CELL..MAX_CELL', () => {
            api().resize(MIN_CELL - 1);
            expect(api().cellSize).toBe(MIN_CELL);
            api().resize(MAX_CELL + 1);
            expect(api().cellSize).toBe(MAX_CELL);
        });

        it('is a no-op for a size that clamps to the current one', () => {
            api().resize(MIN_CELL);
            const version = api().gridVersion;
            api().resize(MIN_CELL - 1);
            expect(api().gridVersion).toBe(version);
        });
    });

    it('setGridLock toggles the lock', () => {
        api().setGridLock(true);
        expect(api().gridLock).toBe(true);
        api().setGridLock(false);
        expect(api().gridLock).toBe(false);
    });

    it('refresh bumps gridVersion', () => {
        const version = api().gridVersion;
        api().refresh();
        api().refresh();
        expect(api().gridVersion).toBe(version + 2);
    });
});
