// Authored by - Sarthak Kumar
//
// terrain: round weighted blobs, heavy at the centre and light at the rim. Each blob spreads from a
// random open cell by BFS, so it stays out of cells walled off from its seed; the straight-line
// distance from the seed sets the level and keeps the blob circular. Where blobs overlap the heavier
// level stays. Replaces the existing weights and leaves walls alone, so it can run on top of any maze.

import { CellKind, Coord } from '@/types/grid';
import { MazeGenerator } from '@/types/mazeGenerator';
import { neighbors4, random, shuffle } from '@/features/algo/utils';
import { distance, getId, inBounds } from '@/utils/coord';
import { Queue } from '@/store/queue';
import { WEIGHT_LEVELS } from '@/utils/constants';

const MIN_R = 3,
    MAX_R = 6;

const getWeight = (dist: number, radius: number) => {
    const dr = dist / radius;

    for (let l = 0, n = WEIGHT_LEVELS.length, f = n - 1; l < n; l++, f--) {
        if (dr > f / n) return WEIGHT_LEVELS[l];
    }
    // dr == 0
    return WEIGHT_LEVELS[WEIGHT_LEVELS.length - 1];
};

export const terrainGenerator: MazeGenerator = function* (rows, cols, getCells) {
    yield { type: 'clear-weights' };

    const seedPoints = Math.floor((rows * cols) / 100);
    const currCells = getCells();

    const cells: Coord[] = [];
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (currCells[r * cols + c] === CellKind.wall) continue;
            cells.push({ r, c });
        }
    }

    shuffle(cells);

    const seeds = cells.slice(0, seedPoints);

    const weights = new Int32Array(rows * cols).fill(-1);

    for (const candidate of seeds) {
        const radius = random(MIN_R, MAX_R);

        const seen = new Uint8Array(rows * cols);
        const queue: Queue<Coord> = new Queue(rows * cols);

        const cid = getId(candidate, cols);
        queue.push(candidate);
        seen[cid] = 1;
        const cw = getWeight(0, radius);
        if (cw > weights[cid]) {
            weights[cid] = cw;
            yield { type: 'weight', at: candidate, w: cw };
        }

        while (queue.size()) {
            const u = queue.pop()!;
            for (const v of neighbors4(u)) {
                if (!inBounds(v, rows, cols)) continue;
                const nid = getId(v, cols);
                if (seen[nid] || currCells[nid] === CellKind.wall) continue;

                const d = distance(v, candidate);
                if (d > radius) continue;

                seen[nid] = 1;

                const cw = getWeight(d, radius);
                if (cw > weights[nid]) {
                    weights[nid] = cw;
                    yield { type: 'weight', at: v, w: weights[nid] };
                }

                queue.push(v);
            }
        }
    }

    yield { type: 'done' };
};
