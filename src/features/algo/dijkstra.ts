// Authored by - Sarthak Kumar
//
// dijkstra: shortest path via a binary min-heap priority queue keyed on distance.

import { Coord } from '@/types/grid';
import { PathFinder } from '@/types/algo';
import { neighbors4, pathCost } from './utils';
import { equal, getCoord, getId, inBounds, isWall } from '@/utils/coord';
import { Comparator, min_priority_queue } from '@/store/priority_queue';

type T = { dist: number; id: number };
const comparator: Comparator<T> = (a, b) => {
    return a.dist < b.dist;
};

const inf = 1e9;
export const dijkstra: PathFinder = function* (grid) {
    const { rows, cols, cells, weights, start, goal } = grid;

    const queue = new min_priority_queue<T>(comparator);
    const dist = new Int32Array(rows * cols).fill(inf);
    const parent = new Int32Array(rows * cols).fill(-1);

    const start_id = getId(start, cols);
    dist[start_id] = 0;
    queue.push({ dist: dist[start_id], id: start_id });

    yield { type: 'enqueue', at: start };

    let visited = 0;
    while (!queue.empty()) {
        const { dist: d, id: curr_id } = queue.pop()!;
        const node = getCoord(curr_id, cols);
        if (d > dist[curr_id]) continue;
        visited += 1;

        if (equal(goal, node)) {
            break;
        }

        yield { type: 'visit', at: node };

        for (const neigh of neighbors4(node)) {
            if (!inBounds(neigh, rows, cols)) continue;
            const next_id = getId(neigh, cols);
            if (isWall(cells, next_id)) continue;
            const w = weights[next_id];

            const nd = d + w;

            if (nd < dist[next_id]) {
                dist[next_id] = nd;
                parent[next_id] = curr_id;
                queue.push({ dist: nd, id: next_id });
                yield { type: 'enqueue', at: neigh };
            }
        }
    }

    const path: Coord[] = [];

    if (dist[getId(goal, cols)] < inf) {
        let cur = getId(goal, cols);
        while (cur !== -1) {
            path.push(getCoord(cur, cols));
            cur = parent[cur];
        }

        path.reverse();
    }

    yield { type: 'path', nodes: path, visited, cost: pathCost(path, grid) };
};
