// Authored by - Sarthak Kumar
//
// getGridSnapshot: freezes a plain-data copy of the current grid for an algorithm run.
// Returns null while the markers are hidden (a maze is generating), which silently no-ops Visualize/Step.
// Both marker cells get DEFAULT_WEIGHT in the copy: their weights can't change the route (no path
// enters the start, every path enters the goal once), and doing it here spares every algorithm a special case.

import { GridSnapShot } from '@/types/grid';
import { useGridStore } from '@/features/store';
import { DEFAULT_WEIGHT } from '@/utils/constants';

export const getGridSnapshot = (): GridSnapShot | null => {
    const state = useGridStore.getState();
    if (state.markersHidden) return null;

    const start = { ...state.start };
    const goal = { ...state.goal };
    const sid = state.idx(start.r, start.c);
    const gid = state.idx(goal.r, goal.c);

    const snapWeights = state.weights.slice();
    snapWeights[sid] = DEFAULT_WEIGHT;
    snapWeights[gid] = DEFAULT_WEIGHT;

    return {
        gridVersion: state.gridVersion,
        rows: state.rows,
        cols: state.cols,
        cells: state.cells.slice(),
        weights: snapWeights,
        start,
        goal,
        cellSize: state.cellSize,
        gridLock: state.gridLock,
    };
};
