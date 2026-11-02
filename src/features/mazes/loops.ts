// Authored by - Sarthak Kumar
//
// loops: opens a share of the walls that sit between two passages. Perfect mazes have one route
// between any two cells, so weights can't change it; a loop gives the algorithms a choice.
// Only carves, on top of whatever is on the board: terrain stays and the outer border stays closed.

import { CellKind, Coord } from '@/types/grid';
import { MazeGenerator } from '@/types/mazeGenerator';
import { getId } from '@/utils/coord';
import { shuffle } from '@/features/algo/utils';

const LOOP_SHARE = 0.12;

export const loopsGenerator: MazeGenerator = function* (rows, cols, getCells) {
    const gridCells = getCells();

    const candidates: Coord[] = [];
    for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
            if (gridCells[getId({ r, c }, cols)] !== CellKind.wall) continue;
            const up = gridCells[getId({ r: r - 1, c }, cols)] === CellKind.wall;
            const down = gridCells[getId({ r: r + 1, c }, cols)] === CellKind.wall;
            const left = gridCells[getId({ r, c: c - 1 }, cols)] === CellKind.wall;
            const right = gridCells[getId({ r, c: c + 1 }, cols)] === CellKind.wall;

            if (up && down && !left && !right) {
                candidates.push({ r, c });
            }

            if (!up && !down && left && right) {
                candidates.push({ r, c });
            }
        }
    }

    shuffle(candidates);

    for (const toDelete of candidates.slice(0, Math.floor(LOOP_SHARE * candidates.length))) {
        yield { type: 'carve', at: toDelete };
    }
    yield { type: 'done' };
};
