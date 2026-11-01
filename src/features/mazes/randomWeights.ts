// Authored by - Sarthak Kumar
//
// randomWeights: terrain pattern, an independent per-cell coin flip for a random weight level.
// Replaces the existing weights and leaves walls alone, so it can run on top of any maze.

import { CellKind, Coord } from '@/types/grid';
import { MazeGenerator } from '@/types/mazeGenerator';
import { random, shuffle } from '@/features/algo/utils';
import { WEIGHT_LEVELS } from '@/utils/constants';

const weights_prob = 0.3;

const getRandomWeight = () => {
    const id = random(0, WEIGHT_LEVELS.length - 1);
    return WEIGHT_LEVELS[id];
};

export const randomWeightsGenerator: MazeGenerator = function* (rows, cols, getCells) {
    yield { type: 'clear-weights' };

    const gridCells = getCells();
    const cells: Coord[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (gridCells[r * cols + c] === CellKind.wall) continue;
            cells.push({ r, c });
        }
    }

    shuffle(cells);

    for (const cell of cells) {
        const prob = Math.random();
        if (prob <= weights_prob) {
            yield { type: 'weight', at: cell, w: getRandomWeight() };
        }
    }
    yield { type: 'done' };
};
