// Authored by - Sarthak Kumar
//
// colors: centralized color palette for the grid canvas (base scene + overlay events).
// NOTE: darkPalette is currently identical to lightPalette, and no theme-switch wires it up.

import { WEIGHT_LEVELS } from '@/utils/constants';

export type GridPalette = {
    // base scene
    cellEmpty: string;
    cellWall: string;
    gridLine: string;
    background: string;

    // markers
    start: string;
    goal: string;

    // overlay (algorithms)
    frontier: string;
    visited: string;
    pathCell: string;

    // one tint per WEIGHT_LEVELS entry, same order; weightMark colours the level dots
    weights: string[];
    weightMark: string;
};

export const lightPalette: GridPalette = {
    cellEmpty: '#ffffff',
    cellWall: '#05181c',
    gridLine: '#8fade8',
    background: '#ffffff',

    start: '#87260e',
    goal: '#ef4444',

    frontier: '#c5e8ee',
    visited: '#74dbef',
    pathCell: '#efea51',

    weights: ['#eadbb8', '#c9a46c', '#8f6b3e'],
    weightMark: 'rgba(45, 30, 10, 0.6)',
};

export const darkPalette: GridPalette = {
    cellEmpty: '#ffffff',
    cellWall: '#05181c',
    gridLine: '#8fade8',
    background: '#ffffff',

    start: '#87260e',
    goal: '#ef4444',

    frontier: '#c5e8ee',
    visited: '#74dbef',
    pathCell: '#efea51',

    weights: ['#eadbb8', '#c9a46c', '#8f6b3e'],
    weightMark: 'rgba(45, 30, 10, 0.6)',
};

// index into WEIGHT_LEVELS, or -1 for a cell at the default weight
export const weightLevel = (w: number) => WEIGHT_LEVELS.indexOf(w);

export const weightColor = (w: number, palette: GridPalette) => {
    const level = weightLevel(w);
    return level < 0 ? palette.cellEmpty : palette.weights[level];
};
