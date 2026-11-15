// Authored by - Sarthak Kumar
//
// bidirectionalBfs: two BFS frontiers grown from start and goal simultaneously,
// alternating one pop per side per iteration, stopping the moment they meet.
// Path is stitched from parent[0] (start-side, reversed) + parent[1] (goal-side).

import { Queue } from '@/lib/data-structures/queue';
import { Coord } from '@/types/grid';
import { PathFinder } from '@/types/algo';
import { neighbors4, pathCost } from './utils';
import { equal, getCoord, getId, inBounds, isWall } from '@/utils/coord';

export const bidirectionalBfs: PathFinder = function* (grid) {
    const { rows, cols, cells, start, goal } = grid;

    // early return for start == end since the algo checks neighbors and not the actual start/end
    if (equal(start, goal)) {
        yield { type: 'enqueue', at: start };
        yield { type: 'path', nodes: [start], visited: 0, cost: 0 };
        return;
    }

    const queue: Queue<Coord>[] = [new Queue(rows * cols), new Queue(rows * cols)];
    const seen = [new Uint8Array(rows * cols).fill(0), new Uint8Array(rows * cols).fill(0)];
    const parent = [new Int32Array(rows * cols).fill(-1), new Int32Array(rows * cols).fill(-1)];

    queue[0].push(start);
    queue[1].push(goal);
    seen[0][getId(start, cols)] = 1;
    seen[1][getId(goal, cols)] = 1;

    yield { type: 'enqueue', at: start };
    yield { type: 'enqueue', at: goal };

    let visited = 0;
    let found = false;
    let mid = -1;
    while (queue[0].size() > 0 && queue[1].size() > 0 && !found) {
        for (let iter = 0; iter < 2 && !found; iter++) {
            const node = queue[iter].pop()!;
            const cid = getId(node, cols);
            visited += 1;

            yield { type: 'visit', at: node };

            for (const neigh of neighbors4(node)) {
                if (!inBounds(neigh, rows, cols)) continue;
                const nid = getId(neigh, cols);
                if (isWall(cells, nid) || seen[iter][nid]) continue;

                queue[iter].push(neigh);
                parent[iter][nid] = cid;
                seen[iter][nid] = 1;
                yield { type: 'enqueue', at: neigh };

                if (seen[iter ^ 1][nid]) {
                    // match from both bfs
                    found = true;
                    mid = nid;
                    break;
                }
            }
        }
    }

    const path: Coord[] = [];

    if (mid !== -1) {
        let cur = mid;
        while (cur !== -1) {
            path.push(getCoord(cur, cols));
            cur = parent[0][cur];
        }
        path.reverse();

        const tail: Coord[] = [];

        cur = parent[1][mid];
        while (cur !== -1) {
            tail.push(getCoord(cur, cols));
            cur = parent[1][cur];
        }

        path.push(...tail);
    }

    yield { type: 'path', nodes: path, visited, cost: pathCost(path, grid) };
};
