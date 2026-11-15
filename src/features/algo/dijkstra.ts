// Authored by - Sarthak Kumar
//
// dijkstra: shortest path via a binary min-heap priority queue keyed on distance.

import { Coord } from '@/types/grid';
import { PathFinder } from '@/types/algo';
import { neighbors4, pathCost } from './utils';
import { equal, getCoord, getId, inBounds, isWall } from '@/utils/coord';
import { Comparator, MinPriorityQueue } from '@/lib/data-structures/priorityQueue';

type T = { dist: number; id: number };
const comparator: Comparator<T> = (a, b) => {
    return a.dist < b.dist;
};

const inf = 1e9;
export const dijkstra: PathFinder = function* (grid) {
    const { rows, cols, cells, weights, start, goal } = grid;

    const queue = new MinPriorityQueue<T>(comparator);
    const dist = new Int32Array(rows * cols).fill(inf);
    const parent = new Int32Array(rows * cols).fill(-1);

    const startId = getId(start, cols);
    dist[startId] = 0;
    queue.push({ dist: dist[startId], id: startId });

    yield { type: 'enqueue', at: start };

    let visited = 0;
    while (!queue.empty()) {
        const { dist: d, id: currId } = queue.pop()!;
        const node = getCoord(currId, cols);
        if (d > dist[currId]) continue;
        visited += 1;

        if (equal(goal, node)) {
            break;
        }

        yield { type: 'visit', at: node };

        for (const neigh of neighbors4(node)) {
            if (!inBounds(neigh, rows, cols)) continue;
            const nextId = getId(neigh, cols);
            if (isWall(cells, nextId)) continue;
            const w = weights[nextId];

            const nd = d + w;

            if (nd < dist[nextId]) {
                dist[nextId] = nd;
                parent[nextId] = currId;
                queue.push({ dist: nd, id: nextId });
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
