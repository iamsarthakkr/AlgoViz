// Authored by - Sarthak Kumar
//
// registry: the single list of pathfinding algorithms and their metadata. Adding an algorithm means
// adding one entry here; everything else is derived from this list, so nothing can fall out of sync.
// - Array order is the dropdown order; algoRegistry[0] is the default selection
// - algorithmMap is what the controller takes, so the controller doesn't depend on the registry shape
// - The contract suite (tests/features/algo/index.test.ts) runs over every entry automatically

import { AlgoEntry, AlgoMap } from '@/types/algo';
import { bfs } from './bfs';
import { dfs } from './dfs';
import { bidirectionalBfs } from './bidirectionalBfs';
import { dijkstra } from './dijkstra';
import { astar } from './astar';

export const algoRegistry: readonly AlgoEntry[] = [
    {
        label: 'Breadth-first search',
        run: bfs,
        shortest: 'unweighted-only',
        weighted: false,
        description:
            'Explores outward in rings, one step at a time. Always finds the shortest path for an unweighted graph.',
    },
    {
        label: 'Depth-first search',
        run: dfs,
        shortest: 'never',
        weighted: false,
        description: 'Follows one route as far as it can before backtracking. Finds a path, not the shortest.',
    },
    {
        label: 'Bidirectional BFS',
        run: bidirectionalBfs,
        shortest: 'unweighted-only',
        weighted: false,
        description:
            'Searches from the start and the goal at once and stops where they meet. Shortest path on unweighted graphs, usually fewer cells visited.',
    },
    {
        label: "Dijkstra's",
        run: dijkstra,
        shortest: 'always',
        weighted: true,
        description: 'Always expands the cheapest cell next. Finds the cheapest path, even across weighted cells.',
    },
    {
        label: 'A*',
        run: astar,
        shortest: 'always',
        weighted: true,
        description:
            'Like Dijkstra, but heads for the goal first. Finds the cheapest path, usually visiting far fewer cells.',
    },
];

export const algoLabels: readonly string[] = algoRegistry.map((entry) => entry.label);
export const algorithmMap: AlgoMap = Object.freeze(
    Object.fromEntries(algoRegistry.map((entry) => [entry.label, entry.run])),
);
