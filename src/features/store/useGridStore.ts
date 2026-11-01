// Authored by - Sarthak Kumar
//
// useGridStore: single source of truth for the grid itself.
// - Flat CellKind[] cell array (index = r*cols+c), start/goal markers, dimensions
// - weights: parallel flat array, the cost to enter each cell. Only plain cells carry weight: walls
//   reset it and setWeight refuses walls, markers and any value outside WEIGHT_LEVELS (the painter
//   only knows those, and a non-number would make the path algorithms skip the cell). A marker
//   dropped on terrain keeps the stored weight so the terrain is back when it moves on
//   (getGridSnapshot makes it not count)
// - Mutators return whether they changed anything, and skip `set` when they didn't (no re-render).
//   Callers refresh() only on true: every gridVersion bump makes the controller re-solve a finished run
// - gridVersion is the manual dirty flag other hooks watch to invalidate cached runs
// - gridLock disables pointer edits while an algorithm/maze is running
// - setStart/setGoal snap to the nearest non-wall cell instead of landing on a wall

import { create } from 'zustand';
import { CellKind, GridState } from '@/types/grid';
import { initGrid, nearestEmptyCell } from '@/utils/grid';
import { clamp } from '@/utils/common';
import { DEFAULT_WEIGHT, MAX_CELL, MIN_CELL, WEIGHT_LEVELS } from '@/utils/constants';

export const useGridStore = create<GridState>((set, get) => {
    const g = initGrid();

    return {
        ...g,

        idx: (r, c) => r * get().cols + c,
        inBounds: (r, c) => r >= 0 && c >= 0 && r < get().rows && c < get().cols,

        at: (r, c) => {
            const s = get();
            return s.cells[s.idx(r, c)];
        },

        weightAt: (r, c) => {
            const s = get();
            return s.weights[s.idx(r, c)];
        },

        setGridLock: (flag) => {
            set(() => ({ gridLock: flag }));
        },

        setWall: (r, c) => {
            const s = get();
            if (!s.inBounds(r, c)) return false;
            if (!s.markersHidden && ((s.start.r === r && s.start.c === c) || (s.goal.r === r && s.goal.c === c))) {
                return false;
            }
            const id = s.idx(r, c);
            if (s.cells[id] === CellKind.wall) return false;

            const newCells = s.cells.slice();
            const newWeights = s.weights.slice();
            newCells[id] = CellKind.wall;
            newWeights[id] = DEFAULT_WEIGHT;

            set({ cells: newCells, weights: newWeights });
            return true;
        },

        clearWall: (r, c) => {
            const s = get();
            const id = s.idx(r, c);
            if (!s.inBounds(r, c) || s.cells[id] !== CellKind.wall) return false;

            const newCells = s.cells.slice();
            newCells[id] = CellKind.empty;

            set({ cells: newCells });
            return true;
        },

        fillWalls: () => {
            const { cells, weights } = get();
            if (!cells.includes(CellKind.empty)) return false;
            set({
                cells: cells.slice().fill(CellKind.wall),
                weights: weights.slice().fill(DEFAULT_WEIGHT),
            });
            return true;
        },

        clearWalls: () => {
            const { cells } = get();
            if (!cells.includes(CellKind.wall)) return false;

            set({ cells: cells.slice().fill(CellKind.empty) });
            return true;
        },

        setWeight: (r, c, w) => {
            const s = get();
            if (!s.inBounds(r, c) || !WEIGHT_LEVELS.includes(w)) return false;
            // don’t overwrite markers
            if ((s.start.r === r && s.start.c === c) || (s.goal.r === r && s.goal.c === c)) return false;

            const id = s.idx(r, c);
            if (s.cells[id] === CellKind.wall || s.weights[id] === w) return false;

            const newWeights = s.weights.slice();
            newWeights[id] = w;

            set({ weights: newWeights });
            return true;
        },

        clearWeight: (r, c) => {
            const s = get();
            if (!s.inBounds(r, c)) return false;
            const id = s.idx(r, c);
            if (s.cells[id] === CellKind.wall || s.weights[id] === DEFAULT_WEIGHT) return false;

            const newWeights = s.weights.slice();
            newWeights[id] = DEFAULT_WEIGHT;

            set({ weights: newWeights });
            return true;
        },

        clearWeights: () => {
            const s = get();
            if (s.weights.findIndex((w) => w > DEFAULT_WEIGHT) < 0) return false;

            set({ weights: s.weights.slice().fill(DEFAULT_WEIGHT) });
            return true;
        },

        setStart: (r, c) => {
            const s = get();
            r = clamp(r, 0, s.rows - 1);
            c = clamp(c, 0, s.cols - 1);
            const snapped = nearestEmptyCell(r, c, s.rows, s.cols, s.cells);
            if (snapped.r === s.start.r && snapped.c === s.start.c) return false;
            if (snapped.r === s.goal.r && snapped.c === s.goal.c) return false;

            set({ start: snapped });
            return true;
        },

        setGoal: (r, c) => {
            const s = get();
            r = clamp(r, 0, s.rows - 1);
            c = clamp(c, 0, s.cols - 1);
            const snapped = nearestEmptyCell(r, c, s.rows, s.cols, s.cells);
            if (snapped.r === s.start.r && snapped.c === s.start.c) return false;
            if (snapped.r === s.goal.r && snapped.c === s.goal.c) return false;

            set({ goal: snapped });
            return true;
        },

        hideMarkers: () => {
            const s = get();
            if (s.markersHidden) return false;
            set({ markersHidden: true });
            return true;
        },

        showMarkers: () => {
            const s = get();
            if (!s.markersHidden) return false;
            const start = nearestEmptyCell(s.start.r, s.start.c, s.rows, s.cols, s.cells);
            const goal = nearestEmptyCell(s.goal.r, s.goal.c, s.rows, s.cols, s.cells, [start]);
            set({ markersHidden: false, start, goal });
            return true;
        },

        reset: (rows, cols, cellSize) =>
            set((s) => {
                const grid = initGrid(rows, cols, cellSize);
                grid.gridVersion = s.gridVersion + 1;
                return grid;
            }),

        resize: (cellSize) =>
            set((s) => {
                const finalCellSize = clamp(cellSize, MIN_CELL, MAX_CELL);
                return s.cellSize === finalCellSize ? {} : { cellSize: finalCellSize, gridVersion: s.gridVersion + 1 };
            }),

        refresh: () => set((s) => ({ gridVersion: s.gridVersion + 1 })),
    };
});
