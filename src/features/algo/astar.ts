// Authored by - Sarthak Kumar
//
// astar: cheapest path, like dijkstra, but the heap is keyed on f = g + h, where h is the Manhattan
// distance to the goal. That can't overestimate: every step costs at least DEFAULT_WEIGHT. Ties on f
// go to the cell nearer the goal; on an open board most cells tie, and this keeps the search on a line.
// - closed skips stale heap copies: with this h, a cell's first pop is already its cheapest

import { Coord } from '@/types/grid';
import { PathFinder } from '@/types/algo';
import { neighbors4, pathCost } from './utils';
import { Comparator, MinPriorityQueue } from '@/lib/data-structures/priorityQueue';
import { equal, getCoord, getId, inBounds, isWall, manhattan } from '@/utils/coord';

type T = { dist: number; id: number; tie: number };
const comparator: Comparator<T> = (a, b) => {
    if (a.dist === b.dist) return a.tie < b.tie;
    return a.dist < b.dist;
};

const inf = 1e9;
export const astar: PathFinder = function* (grid) {
    const { rows, cols, cells, weights, start, goal } = grid;

    const h = (s: Coord) => manhattan(s, goal);

    const queue = new MinPriorityQueue<T>(comparator);
    const dist = new Int32Array(rows * cols).fill(inf);
    const parent = new Int32Array(rows * cols).fill(-1);
    const closed = new Uint8Array(rows * cols);

    const startId = getId(start, cols);
    dist[startId] = 0;
    queue.push({ dist: dist[startId] + h(start), id: startId, tie: h(start) });

    yield { type: 'enqueue', at: start };

    let visited = 0;
    while (!queue.empty()) {
        const { id: currId } = queue.pop()!;
        const node = getCoord(currId, cols);
        if (closed[currId]) continue;
        closed[currId] = 1;

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

            const nd = dist[currId] + w;

            if (nd < dist[nextId]) {
                dist[nextId] = nd;
                parent[nextId] = currId;
                queue.push({ dist: nd + h(neigh), id: nextId, tie: h(neigh) });
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
