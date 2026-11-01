// Authored by - Sarthak Kumar
//
// registry: every maze/pattern generator as one entry (label, run, group); array order is the menu order.
// mazeMap and the dropdown's mazeSections are derived from it, so they can't drift.
// - the three Recursive Division entries share one factory, parameterized by vertical_prob

import { MazeEntry, MazeMap } from '@/types/mazeGenerator';
import { floodFill } from './floodFill';
import { prims } from './prims';
import { randomGenerator } from './random';
import { recursiveDivision } from './recursiveDivision';
import { clearBoard, clearWalls, clearWeights } from './clear';

export const mazeRegistry: readonly MazeEntry[] = [
    { label: 'Recursive Division', run: recursiveDivision(), group: 'Mazes' },
    { label: 'Recursive Division (vertical skew)', run: recursiveDivision(0.7), group: 'Mazes' },
    { label: 'Recursive Division (horizontal skew)', run: recursiveDivision(0.3), group: 'Mazes' },
    { label: "Prim's", run: prims, group: 'Mazes' },
    { label: 'Randomized Depth First Search', run: floodFill, group: 'Mazes' },
    { label: 'Random Walls', run: randomGenerator, group: 'Mazes' },

    { label: 'Clear Walls', run: clearWalls, group: 'Clear' },
    { label: 'Clear Weights', run: clearWeights, group: 'Clear' },
    { label: 'Clear Board', run: clearBoard, group: 'Clear' },
];

export const mazeGroups: readonly string[] = Array.from(new Set(mazeRegistry.map((entry) => entry.group)));
export const mazeMap: MazeMap = Object.freeze(
    Object.fromEntries(mazeRegistry.map((entry) => [entry.label, entry.run])),
);
export const mazeSections = mazeGroups.map((group) => ({
    title: group,
    options: mazeRegistry.filter((entry) => entry.group === group).map((e) => e.label),
}));
