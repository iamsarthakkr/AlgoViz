// Authored by - Sarthak Kumar
//
// useMazeGenerator: orchestrates maze generation playback.
// - Unlike useAlgoController, events write directly into useGridStore (walls ARE grid state)
// - Hides start/goal + locks the grid for the run, shows them again (re-snapped) on the `done` event
// - Each event maps to one store call. Whether walls or weights get reset is the generator's choice:
//   fill-wall drops weights too, clear-wall keeps them (clear-weights does that)
// - Always autoplays; no pause/step controls are exposed for maze generation

import { useCallback, useRef, useState } from 'react';

import { createRunner, RunnerApi } from './runner';
import { getGridSnapshot } from './utils';
import { MazeGeneratorEvent, MazeMap } from '@/types/mazeGenerator';
import { useGridStore } from '@/features/store';
import { Callback } from '@/types/common';

export type MazeGeneratorApi = {
    generate: (key: string) => void;
};

type Options = {
    speed?: number; // EPS
};

export function useMazeGenerator(registry: MazeMap, opts: Options = {}): MazeGeneratorApi {
    const [speed] = useState<number>(opts.speed ?? 120);
    const runnerRef = useRef<RunnerApi<MazeGeneratorEvent>>(null);
    const clearnupRef = useRef<Callback>(null);

    const generateMaze = useCallback(
        (key: string) => {
            const algo = registry[key];
            if (!algo) return null;

            if (runnerRef.current) {
                runnerRef.current.pause();
                runnerRef.current = null;
            }

            if (clearnupRef.current) {
                clearnupRef.current();
                clearnupRef.current = null;
            }

            const snap = getGridSnapshot();
            if (!snap) return null;

            const gridApi = useGridStore.getState();

            // block updates to grid
            gridApi.setGridLock(true);
            gridApi.hideMarkers();

            clearnupRef.current = () => {
                // set back start and goal
                gridApi.showMarkers();

                // enable updates on grid
                useGridStore.getState().setGridLock(false);
                useGridStore.getState().refresh();
            };

            const gen = algo(snap.rows, snap.cols, () => useGridStore.getState().cells);
            runnerRef.current = createRunner(
                gen,
                (event) => {
                    // handle events
                    switch (event.type) {
                        case 'fill-wall':
                            gridApi.fillWalls();
                            break;
                        case 'clear-wall':
                            gridApi.clearWalls();
                            break;
                        case 'carve':
                            gridApi.clearWall(event.at.r, event.at.c);
                            break;
                        case 'wall':
                            gridApi.setWall(event.at.r, event.at.c);
                            break;
                        case 'weight':
                            gridApi.setWeight(event.at.r, event.at.c, event.w);
                            break;
                        case 'clear-weights':
                            gridApi.clearWeights();
                            break;
                        case 'done':
                            if (clearnupRef.current) {
                                clearnupRef.current();
                                clearnupRef.current = null;
                            }
                            break;
                        default:
                            break;
                    }
                },
                {
                    speed: speed,
                },
            );
            runnerRef.current.play();
        },
        [speed, registry],
    );

    return {
        generate: generateMaze,
    };
}
