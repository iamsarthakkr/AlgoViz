// Authored by - Sarthak Kumar
//
// coord: small pure helpers for { r, c } coordinates on the flat grid.

import { Coord } from '@/types/grid';

export const getId = (coord: Coord, cols: number) => coord.r * cols + coord.c;
export const inBounds = (coord: Coord, rows: number, cols: number) =>
    coord.r >= 0 && coord.r < rows && coord.c >= 0 && coord.c < cols;

export const equal = (a: Coord, b: Coord) => a.r === b.r && a.c === b.c;
export const distance = (a: Coord, b: Coord) => Math.hypot(a.r - b.r, a.c - b.c);
export const manhattan = (a: Coord, b: Coord) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
