// Authored by - Sarthak Kumar
//
// greedy: best-first search keyed on h alone, the Manhattan distance to the goal. It always expands
// the cell that looks nearest, ignoring what it cost to get there, so it's fast on open boards but
// walks into dead ends and ignores weights. The contrast with A* is the point: A* is this plus g.
// - seen marks a cell when it's first enqueued, like BFS: with no g there's nothing to improve later,
//   so the first parent is kept

import { Coord } from '@/types/grid';
import { PathFinder } from '@/types/algo';
import { neighbors4, pathCost } from './utils';
import { Comparator, MinPriorityQueue } from '@/lib/data-structures/priorityQueue';
import { equal, getCoord, getId, inBounds, isWall, manhattan } from '@/utils/coord';

type T = { h: number; id: number };
const comparator: Comparator<T> = (a, b) => a.h < b.h;

export const greedy: PathFinder = function* (grid) {
    const { rows, cols, cells, start, goal } = grid;

    const h = (s: Coord) => manhattan(s, goal);

    const queue = new MinPriorityQueue<T>(comparator);
    const parent = new Int32Array(rows * cols).fill(-1);
    const seen = new Uint8Array(rows * cols);

    const startId = getId(start, cols);
    seen[startId] = 1;
    queue.push({ h: h(start), id: startId });

    yield { type: 'enqueue', at: start };

    let visited = 0;
    let found = false;
    while (!queue.empty()) {
        const { id: currId } = queue.pop()!;
        const node = getCoord(currId, cols);

        visited += 1;

        if (equal(goal, node)) {
            found = true;
            break;
        }

        yield { type: 'visit', at: node };

        for (const neigh of neighbors4(node)) {
            if (!inBounds(neigh, rows, cols)) continue;
            const nextId = getId(neigh, cols);
            if (isWall(cells, nextId)) continue;
            if (seen[nextId]) continue;

            seen[nextId] = 1;
            parent[nextId] = currId;
            queue.push({ h: h(neigh), id: nextId });
            yield { type: 'enqueue', at: neigh };
        }
    }

    const path: Coord[] = [];

    if (found) {
        let cur = getId(goal, cols);
        while (cur !== -1) {
            path.push(getCoord(cur, cols));
            cur = parent[cur];
        }

        path.reverse();
    }

    yield { type: 'path', nodes: path, visited, cost: pathCost(path, grid) };
};
