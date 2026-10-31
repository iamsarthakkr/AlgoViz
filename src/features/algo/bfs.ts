// Authored by - Sarthak Kumar
//
// bfs: breadth-first search. Guarantees shortest path on an unweighted grid.
// Generator yields {enqueue|visit} per step, terminal {path} once goal is reached/exhausted.

import { Queue } from '@/store/queue';
import { CellKind, Coord } from '@/types/grid';
import { PathFinder } from '@/types/algo';
import { equal, neighbors4, pathCost } from './utils';

export const bfs: PathFinder = function* (grid) {
    const { rows, cols, cells, start, goal } = grid;

    if (equal(start, goal)) {
        yield { type: 'enqueue', at: start };
        yield { type: 'path', nodes: [start], visited: 0, cost: 0 };
        return;
    }

    const id = (s: Coord) => s.r * cols + s.c;
    const inb = (s: Coord) => s.r >= 0 && s.r < rows && s.c >= 0 && s.c < cols;
    const isWall = (s: Coord) => cells[id(s)] === CellKind.wall;
    const getCoord = (id: number): Coord => ({ r: Math.floor(id / cols), c: id % cols });

    const queue: Queue<Coord> = new Queue(rows * cols);
    const seen = new Uint8Array(rows * cols);
    const parent = new Int32Array(rows * cols).fill(-1);

    queue.push(start);
    seen[id(start)] = 1;

    yield { type: 'enqueue', at: start };

    let visited = 0;
    let found = false;
    while (queue.size()) {
        if (found) break;
        const node = queue.pop()!;
        const cid = id(node);
        visited += 1;

        yield { type: 'visit', at: node };

        for (const neigh of neighbors4(node)) {
            if (!inb(neigh) || isWall(neigh)) continue;
            const nid = id(neigh);
            if (seen[nid]) continue;

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

    if (seen[id(goal)]) {
        let cur = id(goal);
        while (cur !== -1) {
            path.push(getCoord(cur));
            cur = parent[cur];
        }

        path.reverse();
    }

    yield { type: 'path', nodes: path, visited, cost: pathCost(path, grid) };
};
