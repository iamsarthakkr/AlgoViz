// Authored by - Sarthak Kumar
//
// dfs: depth-first search. Explores greedily via an explicit stack — does NOT
// guarantee the shortest path. Same generator/event shape as the other algorithms.

import { PathFinder } from '@/types/algo';
import { CellKind, Coord } from '@/types/grid';
import { equal, neighbors4, pathCost } from './utils';

export const dfs: PathFinder = function* (grid) {
    const { rows, cols, cells, start, goal } = grid;

    const id = (s: Coord) => s.r * cols + s.c;
    const inb = (s: Coord) => s.r >= 0 && s.r < rows && s.c >= 0 && s.c < cols;
    const isWall = (s: Coord) => cells[id(s)] === CellKind.wall;
    const getCoord = (id: number): Coord => ({ r: Math.floor(id / cols), c: id % cols });

    const stack: Coord[] = [];
    const seen = new Uint8Array(rows * cols);
    const parent = new Int32Array(rows * cols).fill(-1);

    stack.push(start);
    seen[id(start)] = 1;
    yield { type: 'enqueue', at: start };

    let visited = 0;
    let found = false;
    while (stack.length > 0) {
        if (found) break;

        const u = stack.pop()!;
        const cid = id(u);

        visited += 1;
        yield { type: 'visit', at: u };

        if (equal(goal, u)) {
            found = true;
            break;
        }

        const neighs = neighbors4(u);
        for (let i = neighs.length - 1; i >= 0; --i) {
            const v = neighs[i];

            if (!inb(v) || isWall(v)) continue;
            const nid = id(v);
            if (seen[nid]) continue;

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
