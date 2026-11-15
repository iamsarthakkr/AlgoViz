// Authored by - Sarthak Kumar
//
// clear: the Clear actions, as generators so they go through generate() like any maze: picking one
// mid-maze cancels the maze and restores the markers.

import { MazeGenerator } from '@/types/mazeGenerator';

export const clearWalls: MazeGenerator = function* () {
    yield { type: 'clear-wall' };
    yield { type: 'done' };
};

export const clearWeights: MazeGenerator = function* () {
    yield { type: 'clear-weights' };
    yield { type: 'done' };
};

export const clearBoard: MazeGenerator = function* () {
    yield { type: 'clear-wall' };
    yield { type: 'clear-weights' };
    yield { type: 'done' };
};
