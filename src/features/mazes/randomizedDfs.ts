// Authored by - Sarthak Kumar
//
// randomizedDfs: randomized iterative DFS backtracker ("growing tree" maze) over the
// odd/odd cell lattice — real cells sit at odd coordinates, walls at even coordinates.

import { Coord } from '@/types/grid';
import { MazeGenerator } from '@/types/mazeGenerator';
import { getId, inBounds } from '@/utils/coord';
import { random, secondNeighbors4, shuffle } from '@/features/algo/utils';

// depth first backtracking
export const randomizedDfs: MazeGenerator = function* (rows, cols) {
    yield { type: 'fill-wall' };

    const stack: Coord[] = [];
    const seen = new Uint8Array(rows * cols);

    const start: Coord = {
        r: (random(0, Math.floor((rows - 2) / 2)) | 0) * 2 + 1,
        c: (random(0, Math.floor((cols - 2) / 2)) | 0) * 2 + 1,
    };

    stack.push(start);
    seen[getId(start, cols)] = 1;
    yield { type: 'carve', at: start };

    while (stack.length > 0) {
        const u = stack[stack.length - 1];

        let neighs = secondNeighbors4(u);
        shuffle(neighs);
        neighs = neighs.filter((v) => {
            return inBounds(v, rows, cols) && !seen[getId(v, cols)];
        });

        if (neighs.length === 0) {
            stack.pop();
            continue;
        }

        const to = neighs[random(0, neighs.length - 1)];
        const toId = getId(to, cols);

        const mid: Coord = {
            r: (u.r + to.r) / 2,
            c: (u.c + to.c) / 2,
        };

        yield { type: 'carve', at: mid };
        yield { type: 'carve', at: to };

        seen[toId] = 1;
        stack.push(to);
    }

    yield { type: 'done' };
};
