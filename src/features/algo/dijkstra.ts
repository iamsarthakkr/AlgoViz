// Authored by - Sarthak Kumar
//
// dijkstra: shortest path via a binary min-heap priority queue keyed on distance.

import { CellKind, Coord } from '@/types/grid';
import { PathFinder } from '@/types/algo';
import { equal, neighbors4, pathCost } from './utils';
import { min_priority_queue } from '@/store/priority_queue';

const inf = 1e9;
export const dijkstra: PathFinder = function* (grid) {
    const { rows, cols, cells, weights, start, goal } = grid;

    const id = (s: Coord) => s.r * cols + s.c;
    const inb = (s: Coord) => s.r >= 0 && s.r < rows && s.c >= 0 && s.c < cols;
    const isWall = (s: Coord) => cells[id(s)] === CellKind.wall;
    const getCoord = (id: number): Coord => ({ r: Math.floor(id / cols), c: id % cols });

    const queue = new min_priority_queue();
    const dist = new Int32Array(rows * cols).fill(inf);
    const parent = new Int32Array(rows * cols).fill(-1);

    const start_id = id(start);
    dist[start_id] = 0;
    queue.push(dist[start_id], start_id);

    yield { type: 'enqueue', at: start };

    let visited = 0;
    let found = false;
    while (!queue.empty()) {
        if (found) break;
        const { dist: d, id: curr_id } = queue.pop()!;
        const node = getCoord(curr_id);
        if (d > dist[curr_id]) continue;
        visited += 1;

        if (equal(goal, node)) {
            found = true;
            break;
        }

        yield { type: 'visit', at: node };

        for (const neigh of neighbors4(node)) {
            if (!inb(neigh) || isWall(neigh)) continue;
            const next_id = id(neigh);
            const w = weights[next_id];

            const nd = d + w;

            if (nd < dist[next_id]) {
                dist[next_id] = nd;
                parent[next_id] = curr_id;
                queue.push(nd, next_id);
                yield { type: 'enqueue', at: neigh };
            }
        }
    }

    const path: Coord[] = [];

    if (dist[id(goal)] < inf) {
        let cur = id(goal);
        while (cur !== -1) {
            path.push(getCoord(cur));
            cur = parent[cur];
        }

        path.reverse();
    }

    yield { type: 'path', nodes: path, visited, cost: pathCost(path, grid) };
};
