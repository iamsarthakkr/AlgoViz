// Authored by - Sarthak Kumar
//
// algo types: the pathfinding generator contract. A PathFinder yields enqueue/visit
// events as it works, then exactly one terminal `path` event with the reconstructed nodes.
// Also the registry entry shape (AlgoEntry) and the label -> PathFinder lookup (AlgoMap).

import { Coord, GridSnapShot } from './grid';

export type AlgoEntry = {
    label: string; // also its key: the dropdown, the settings store and algorithmMap all use it
    run: PathFinder;
    weighted: boolean;
    shortest: 'always' | 'unweighted-only' | 'never'; // when its path is guaranteed the cheapest
    description: string;
};

export type AlgoMap = Record<string, PathFinder>;

export enum AlgoStatus {
    initial = 0,
    running,
    paused,
    done,
}

export type EnqueueEvent = { type: 'enqueue'; at: Coord };
export type VisitEvent = { type: 'visit'; at: Coord };
export type PathEvent = { type: 'path'; nodes: Coord[]; visited: number; cost: number };

export type AlgoEvent = EnqueueEvent | VisitEvent | PathEvent;

export type AlgoGenerator = Generator<AlgoEvent, void, void>;
export type PathFinder = (grid: GridSnapShot) => AlgoGenerator;
