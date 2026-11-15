// Authored by - Sarthak Kumar
//
// dfs: depth-first search. Explores greedily via an explicit stack — does NOT
// guarantee the shortest path. Same generator/event shape as the other algorithms.

import { PathFinder } from '@/types/algo';
import { Coord } from '@/types/grid';
import { neighbors4, pathCost } from './utils';
import { equal, getCoord, getId, inBounds, isWall } from '@/utils/coord';

export const dfs: PathFinder = function* (grid) {
    const { rows, cols, cells, start, goal } = grid;

    const stack: Coord[] = [];
    const seen = new Uint8Array(rows * cols);
    const parent = new Int32Array(rows * cols).fill(-1);

    stack.push(start);
    seen[getId(start, cols)] = 1;
    yield { type: 'enqueue', at: start };

    let visited = 0;
    let found = false;
    while (stack.length > 0) {
        if (found) break;

        const u = stack.pop()!;
        const cid = getId(u, cols);

        visited += 1;
        yield { type: 'visit', at: u };

        if (equal(goal, u)) {
            found = true;
            break;
        }

        const neighs = neighbors4(u);
        for (let i = neighs.length - 1; i >= 0; --i) {
            const v = neighs[i];

            if (!inBounds(v, rows, cols)) continue;
            const nid = getId(v, cols);
            if (isWall(cells, nid) || seen[nid]) continue;

            seen[nid] = 1;
            parent[nid] = cid;

            stack.push(v);
            yield { type: 'enqueue', at: v };

            if (equal(goal, v)) {
                found = true;
                break;
            }
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
