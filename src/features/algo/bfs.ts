// Authored by - Sarthak Kumar
//
// bfs: breadth-first search. Guarantees shortest path on an unweighted grid.
// Generator yields {enqueue|visit} per step, terminal {path} once goal is reached/exhausted.

import { Queue } from '@/store/queue';
import { Coord } from '@/types/grid';
import { PathFinder } from '@/types/algo';
import { neighbors4, pathCost } from './utils';
import { equal, getCoord, getId, inBounds, isWall } from '@/utils/coord';

export const bfs: PathFinder = function* (grid) {
    const { rows, cols, cells, start, goal } = grid;

    if (equal(start, goal)) {
        yield { type: 'enqueue', at: start };
        yield { type: 'path', nodes: [start], visited: 0, cost: 0 };
        return;
    }

    const queue: Queue<Coord> = new Queue(rows * cols);
    const seen = new Uint8Array(rows * cols);
    const parent = new Int32Array(rows * cols).fill(-1);

    queue.push(start);
    seen[getId(start, cols)] = 1;

    yield { type: 'enqueue', at: start };

    let visited = 0;
    let found = false;
    while (queue.size()) {
        if (found) break;
        const node = queue.pop()!;
        const cid = getId(node, cols);
        visited += 1;

        yield { type: 'visit', at: node };

        for (const neigh of neighbors4(node)) {
            if (!inBounds(neigh, rows, cols)) continue;
            const nid = getId(neigh, cols);
            if (isWall(cells, nid) || seen[nid]) continue;

            yield { type: 'enqueue', at: neigh };
            parent[nid] = cid;
            seen[nid] = 1;
            if (equal(goal, neigh)) {
                found = true;
                break;
            }

            queue.push(neigh);
        }
    }

    const path: Coord[] = [];

    if (seen[getId(goal, cols)]) {
        let cur = getId(goal, cols);
        while (cur !== -1) {
            path.push(getCoord(cur, cols));
            cur = parent[cur];
        }

        path.reverse();
    }

    yield { type: 'path', nodes: path, visited, cost: pathCost(path, grid) };
};
