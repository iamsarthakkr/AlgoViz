// Authored by - Sarthak Kumar
//
// grid types: core Grid shape + GridState (Grid + useGridStore's actions).
// Coords are flattened to r*cols+c everywhere — there's no 2D array anywhere in the app.

export type Coord = { r: number; c: number };

export enum CellKind {
    empty,
    wall,
}
export enum DragMode {
    None,
    Paint,
    Erase,
    MoveStart,
    MoveGoal,
}

// what a drag on the grid paints (a selection in useSettingsStore, picked in the legend)
export type WallTool = { type: 'wall' };
export type WeightTool = { type: 'weight'; weight: number };

export type DrawTool = WallTool | WeightTool;

export type Grid = {
    gridVersion: number;
    rows: number;
    cols: number;
    cellSize: number;
    cells: CellKind[];
    weights: number[]; // cost to enter each cell
    start: Coord;
    goal: Coord;
    gridLock: boolean;
    markersHidden: boolean;
};

export type GridState = Grid & {
    idx(r: number, c: number): number;
    inBounds(r: number, c: number): boolean;
    at(r: number, c: number): CellKind;
    weightAt(r: number, c: number): number;

    setWall(r: number, c: number): boolean;
    clearWall(r: number, c: number): boolean;
    clearWalls(): boolean;
    fillWalls(): boolean;

    setWeight(r: number, c: number, w: number): boolean;
    clearWeight(r: number, c: number): boolean;
    clearWeights(): boolean;

    setStart(r: number, c: number): boolean;
    setGoal(r: number, c: number): boolean;
    hideMarkers(): boolean;
    showMarkers(): boolean;

    setGridLock(flag: boolean): void;

    refresh(): void;
    reset(rows?: number, cols?: number, cellSize?: number): void;
    resize(cellSize: number): void;
};

export type GridSnapShot = Omit<Grid, 'markersHidden'>;

export type GridLayout = Pick<Grid, 'rows' | 'cols' | 'cellSize'>;
