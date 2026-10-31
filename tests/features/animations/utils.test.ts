import { describe, expect, it } from 'vitest';
import { getGridSnapshot } from '@/features/animations/utils';
import { useGridStore } from '@/features/store';
import { CellKind } from '@/types/grid';
import { DEFAULT_WEIGHT, WEIGHT_LEVELS } from '@/utils/constants';

describe('getGridSnapshot', () => {
    it('returns a copy of the grid', () => {
        const snap = getGridSnapshot()!;
        const state = useGridStore.getState();
        expect(snap).toEqual({
            gridVersion: state.gridVersion,
            rows: state.rows,
            cols: state.cols,
            cellSize: state.cellSize,
            cells: state.cells,
            weights: state.weights,
            start: state.start,
            goal: state.goal,
            gridLock: state.gridLock,
        });
    });

    // An algorithm run must not see edits made while it's animating
    it('is detached from later store updates', () => {
        const snap = getGridSnapshot()!;
        useGridStore.getState().setWall(0, 0);
        useGridStore.getState().setWeight(0, 1, WEIGHT_LEVELS[0]);
        useGridStore.getState().setStart(0, 3);
        expect(snap.cells[0]).toBe(CellKind.empty);
        expect(snap.weights[1]).toBe(DEFAULT_WEIGHT);
        expect(snap.start).not.toEqual({ r: 0, c: 3 });
    });

    it('returns null while the markers are hidden (during maze generation)', () => {
        useGridStore.getState().hideMarkers();
        expect(getGridSnapshot()).toBeNull();
        useGridStore.getState().showMarkers();
        expect(getGridSnapshot()).not.toBeNull();
    });

    // A marker's weight never matters for the route (no path enters the start; every path enters the
    // goal exactly once), so algorithms see both marker cells at the default weight. Done here, once,
    // so no algorithm needs a marker special case.
    it('treats the start and goal cells as default weight, even when terrain is stored under them', () => {
        const api = useGridStore.getState();
        const heavy = WEIGHT_LEVELS[WEIGHT_LEVELS.length - 1];
        const { start, goal } = api;
        const besideStart = { r: start.r, c: start.c + 1 };
        const besideGoal = { r: goal.r, c: goal.c - 1 };
        api.setWeight(besideStart.r, besideStart.c, heavy);
        api.setWeight(besideGoal.r, besideGoal.c, heavy);
        api.setStart(besideStart.r, besideStart.c); // markers dropped onto terrain
        api.setGoal(besideGoal.r, besideGoal.c);

        const snap = getGridSnapshot()!;
        const id = (p: { r: number; c: number }) => p.r * snap.cols + p.c;
        expect(snap.weights[id(besideStart)]).toBe(DEFAULT_WEIGHT);
        expect(snap.weights[id(besideGoal)]).toBe(DEFAULT_WEIGHT);
        // only the copy: the store keeps the terrain for when the markers move on
        expect(useGridStore.getState().weights[id(besideStart)]).toBe(heavy);
    });
});
