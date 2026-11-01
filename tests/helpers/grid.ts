import { CellKind, Coord, GridSnapShot } from '@/types/grid';
import { DEFAULT_WEIGHT, WEIGHT_LEVELS } from '@/utils/constants';
import { AlgoEvent, AlgoGenerator, PathEvent } from '@/types/algo';
import { MazeGenerator, MazeGeneratorEvent } from '@/types/mazeGenerator';

/**
 * Builds a grid snapshot from an ASCII picture:
 *   '.' empty, '#' wall, 'S' start, 'G' goal,
 *   '1' / '2' / '3' a weighted cell at WEIGHT_LEVELS[0] / [1] / [2] (light / medium / heavy)
 */
export function parseGrid(picture: string[]): GridSnapShot {
    const rows = picture.length;
    const cols = picture[0].length;
    const cells: CellKind[] = [];
    const weights: number[] = [];
    let start: Coord | null = null;
    let goal: Coord | null = null;

    picture.forEach((line, r) => {
        if (line.length !== cols) throw new Error(`row ${r} has ${line.length} cols, expected ${cols}`);
        [...line].forEach((ch, c) => {
            cells.push(ch === '#' ? CellKind.wall : CellKind.empty);
            const level = '123'.indexOf(ch);
            weights.push(level >= 0 ? WEIGHT_LEVELS[level] : DEFAULT_WEIGHT);
            if (ch === 'S') start = { r, c };
            if (ch === 'G') goal = { r, c };
        });
    });
    if (!start || !goal) throw new Error('picture needs both S and G');

    return {
        gridVersion: 0,
        rows,
        cols,
        cellSize: 10,
        cells,
        weights,
        start,
        goal,
        gridLock: false,
    };
}

export function emptyGrid(rows: number, cols: number, start: Coord, goal: Coord): GridSnapShot {
    const cells: CellKind[] = Array(rows * cols).fill(CellKind.empty);
    const weights: number[] = Array(rows * cols).fill(DEFAULT_WEIGHT);
    return {
        gridVersion: 0,
        rows,
        cols,
        cellSize: 10,
        cells,
        weights,
        start,
        goal,
        gridLock: false,
    };
}

export function collect<T>(gen: Generator<T, void, void>): T[] {
    return [...gen];
}

/** Runs a maze generator to the end, on an open board unless given one. */
export function runMaze(
    gen: MazeGenerator,
    rows: number,
    cols: number,
    cells: CellKind[] = Array(rows * cols).fill(CellKind.empty),
): MazeGeneratorEvent[] {
    return collect(gen(rows, cols, () => cells));
}

export function runToPath(gen: AlgoGenerator): { events: AlgoEvent[]; path: PathEvent } {
    const events = collect(gen);
    const last = events[events.length - 1];
    if (!last || last.type !== 'path') throw new Error('generator did not end with a path event');
    return { events, path: last };
}

const inBounds = (g: { rows: number; cols: number }, p: Coord) => p.r >= 0 && p.c >= 0 && p.r < g.rows && p.c < g.cols;

/** Reference BFS distance (edges) from start to goal; -1 when unreachable. */
export function referenceDistance(grid: GridSnapShot): number {
    const { rows, cols, cells, start, goal } = grid;
    const dist = new Array(rows * cols).fill(-1);
    const q: Coord[] = [start];
    dist[start.r * cols + start.c] = 0;
    for (let i = 0; i < q.length; i++) {
        const u = q[i];
        for (const [dr, dc] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
        ]) {
            const v = { r: u.r + dr, c: u.c + dc };
            const k = v.r * cols + v.c;
            if (!inBounds(grid, v) || cells[k] === CellKind.wall || dist[k] !== -1) continue;
            dist[k] = dist[u.r * cols + u.c] + 1;
            q.push(v);
        }
    }
    return dist[goal.r * cols + goal.c];
}

/** What a path really costs: the weight of every cell entered, so every cell but the first. */
export function costOf(grid: GridSnapShot, nodes: Coord[]): number {
    return nodes.slice(1).reduce((sum, p) => sum + grid.weights[p.r * grid.cols + p.c], 0);
}

/** Reference cheapest cost from start to goal; -1 when unreachable. Repeated relaxation, so it shares nothing with dijkstra. */
export function referenceCost(grid: GridSnapShot): number {
    const { rows, cols, cells, weights, start, goal } = grid;
    const dist = new Array(rows * cols).fill(Infinity);
    dist[start.r * cols + start.c] = 0;
    for (let changed = true; changed;) {
        changed = false;
        for (let k = 0; k < dist.length; k++) {
            if (dist[k] === Infinity) continue;
            const u = { r: Math.floor(k / cols), c: k % cols };
            for (const [dr, dc] of [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ]) {
                const v = { r: u.r + dr, c: u.c + dc };
                const next = v.r * cols + v.c;
                if (!inBounds(grid, v) || cells[next] === CellKind.wall) continue;
                if (dist[k] + weights[next] < dist[next]) {
                    dist[next] = dist[k] + weights[next];
                    changed = true;
                }
            }
        }
    }
    const cost = dist[goal.r * cols + goal.c];
    return cost === Infinity ? -1 : cost;
}

/** Throws with a readable message unless `nodes` is a walkable start→goal path. */
export function expectValidPath(grid: GridSnapShot, nodes: Coord[]) {
    const fail = (msg: string) => {
        throw new Error(`invalid path: ${msg} — ${JSON.stringify(nodes)}`);
    };
    if (!nodes.length) fail('empty');
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (first.r !== grid.start.r || first.c !== grid.start.c) fail('does not begin at start');
    if (last.r !== grid.goal.r || last.c !== grid.goal.c) fail('does not end at goal');

    const seen = new Set<number>();
    nodes.forEach((p, i) => {
        if (!inBounds(grid, p)) fail(`node ${i} out of bounds`);
        const k = p.r * grid.cols + p.c;
        if (grid.cells[k] === CellKind.wall) fail(`node ${i} is a wall`);
        if (seen.has(k)) fail(`node ${i} repeats a cell`);
        seen.add(k);
        if (i > 0) {
            const prev = nodes[i - 1];
            if (Math.abs(prev.r - p.r) + Math.abs(prev.c - p.c) !== 1) fail(`nodes ${i - 1}→${i} not adjacent`);
        }
    });
}

/** Replays maze events onto a cell array the same way useMazeGenerator writes them to the store. */
export function applyMazeEvents(rows: number, cols: number, events: MazeGeneratorEvent[]): CellKind[] {
    let cells: CellKind[] = Array(rows * cols).fill(CellKind.empty);
    for (const e of events) {
        if (e.type === 'fill-wall') cells = cells.map(() => CellKind.wall);
        else if (e.type === 'clear-wall') cells = cells.map(() => CellKind.empty);
        else if (e.type === 'carve' || e.type === 'wall') {
            if (!inBounds({ rows, cols }, e.at)) continue;
            cells[e.at.r * cols + e.at.c] = e.type === 'carve' ? CellKind.empty : CellKind.wall;
        }
    }
    return cells;
}

/** Number of open cells reachable from `from` (4-directional). */
export function countReachable(rows: number, cols: number, cells: CellKind[], from: Coord): number {
    if (cells[from.r * cols + from.c] === CellKind.wall) return 0;
    const seen = new Set<number>([from.r * cols + from.c]);
    const q: Coord[] = [from];
    for (let i = 0; i < q.length; i++) {
        const u = q[i];
        for (const v of [
            { r: u.r + 1, c: u.c },
            { r: u.r - 1, c: u.c },
            { r: u.r, c: u.c + 1 },
            { r: u.r, c: u.c - 1 },
        ]) {
            const k = v.r * cols + v.c;
            if (!inBounds({ rows, cols }, v) || cells[k] === CellKind.wall || seen.has(k)) continue;
            seen.add(k);
            q.push(v);
        }
    }
    return seen.size;
}

export const countOpen = (cells: CellKind[]) => cells.filter((k) => k === CellKind.empty).length;
