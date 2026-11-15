// Authored by - Sarthak Kumar
//
// mazeGenerator types: the maze generator contract. A MazeGenerator(rows, cols, getCells) yields
// wall/carve/weight events (plus fill-wall/clear-wall/clear-weights resets) and a terminal `done`
// event. getCells reads the live board, for generators that build on what's already there.

import { CellKind, Coord } from './grid';

export type CarveEvent = { type: 'carve'; at: Coord };
export type WallEvent = { type: 'wall'; at: Coord };
export type FillWallsEvent = { type: 'fill-wall' };
export type ClearWallsEvent = { type: 'clear-wall' };
export type WeightEvent = { type: 'weight'; w: number; at: Coord };
export type ClearWeightsEvent = { type: 'clear-weights' };
export type FinalEvent = { type: 'done' };

export type MazeGeneratorEvent =
    FillWallsEvent | ClearWallsEvent | CarveEvent | WallEvent | WeightEvent | ClearWeightsEvent | FinalEvent;

export type MazeGenerator = (
    rows: number,
    cols: number,
    getCells: () => CellKind[],
) => Generator<MazeGeneratorEvent, void, void>;

export type MazeEntry = {
    label: string;
    run: MazeGenerator;
    group: 'Mazes' | 'Terrain' | 'Clear';
};

export type MazeMap = Record<string, MazeGenerator>;
