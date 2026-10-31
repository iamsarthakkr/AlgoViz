// Authored by - Sarthak Kumar
//
// algo/utils: shared helpers for pathfinding algorithms and maze generators.
// - random/randomOdd/randomEven/shuffle: RNG helpers (odd/even used for the maze cell lattice)
// - neighbors4/second_neighbors4: 4-directional and 2-cell-away neighbor offsets
// - pathCost: what a path really costs, the weight of every cell after the first (never entered).
//   Used by every algorithm, so one that ignores weights still reports its true cost

import { Coord, GridSnapShot } from '@/types/grid';

export const random = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const randomOdd = (min: number, max: number): number => {
    if ((min & 1) === 0) min++;
    if ((max & 1) === 0) max--;
    if (min > max) throw new Error('No odd number in range');
    return (random(min >> 1, max >> 1) << 1) | 1;
};
export const randomEven = (min: number, max: number): number => {
    if (min & 1) min++;
    if (max & 1) max--;
    if (min > max) throw new Error('No even number in range');
    return random(min >> 1, max >> 1) << 1;
};

export const shuffle = (a: Coord[]) => {
    for (let i = a.length - 1; i > 0; --i) {
        const j = random(0, i);
        [a[i], a[j]] = [a[j], a[i]];
    }
};

export const equal = (a: Coord, b: Coord) => a.r === b.r && a.c === b.c;

const create_neighbors = (p: Coord, dr: number[], dc: number[]): Coord[] => {
    const out: Coord[] = [];
    for (let k = 0; k < dr.length; k++) out.push({ r: p.r + dr[k], c: p.c + dc[k] });
    return out;
};

export const neighbors4 = (p: Coord): Coord[] => {
    const dr = [-1, 0, 1, 0];
    const dc = [0, 1, 0, -1];
    return create_neighbors(p, dr, dc);
};

export const second_neighbors4 = (p: Coord): Coord[] => {
    const dr = [-2, 0, 2, 0];
    const dc = [0, 2, 0, -2];
    return create_neighbors(p, dr, dc);
};

export const pathCost = (path: Coord[], grid: GridSnapShot) => {
    const { cols, weights } = grid;
    let cost = 0;
    path.slice(1).forEach((node) => {
        const id = node.r * cols + node.c;
        cost += weights[id];
    });
    return cost;
};
