// Authored by - Sarthak Kumar
//
// greedy: best-first search keyed on h alone, the Manhattan distance to the goal. It always expands
// the cell that looks nearest, ignoring what it cost to get there, so it's fast on open boards but
// walks into dead ends and ignores weights. The contrast with A* is the point: A* is this plus g.
// - seen marks a cell when it's first enqueued, like BFS: with no g there's nothing to improve later,
//   so the first parent is kept

import { CellKind, Coord } from '@/types/grid';
import { PathFinder } from '@/types/algo';
import { equal, neighbors4, pathCost } from './utils';
import { Comparator, min_priority_queue } from '@/store/priority_queue';
import { getId, inBounds, manhattan } from '@/utils/coord';

type T = { h: number; id: number };
const comparator: Comparator<T> = (a, b) => a.h < b.h;

export const greedy: PathFinder = function* (grid) {
    const { rows, cols, cells, start, goal } = grid;

    const isWall = (s: Coord) => cells[getId(s, cols)] === CellKind.wall;
    const getCoord = (id: number): Coord => ({ r: Math.floor(id / cols), c: id % cols });
    const h = (s: Coord) => manhattan(s, goal);

    const queue = new min_priority_queue<T>(comparator);
    const parent = new Int32Array(rows * cols).fill(-1);
    const seen = new Uint8Array(rows * cols);

    const start_id = getId(start, cols);
    seen[start_id] = 1;
    queue.push({ h: h(start), id: start_id });

    yield { type: 'enqueue', at: start };

    let visited = 0;
    let found = false;
    while (!queue.empty()) {
        const { id: currId } = queue.pop()!;
        const node = getCoord(currId);

        visited += 1;

        if (equal(goal, node)) {
            found = true;
            break;
        }

        yield { type: 'visit', at: node };

        for (const neigh of neighbors4(node)) {
            if (!inBounds(neigh, rows, cols) || isWall(neigh)) continue;
            const next_id = getId(neigh, cols);
            if (seen[next_id]) continue;

            seen[next_id] = 1;
            parent[next_id] = currId;
            queue.push({ h: h(neigh), id: next_id });
            yield { type: 'enqueue', at: neigh };
        }
    }

    const path: Coord[] = [];

    if (found) {
        let cur = getId(goal, cols);
        while (cur !== -1) {
            path.push(getCoord(cur));
            cur = parent[cur];
        }

        path.reverse();
    }

    yield { type: 'path', nodes: path, visited, cost: pathCost(path, grid) };
};
