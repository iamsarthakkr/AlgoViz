// Authored by - Sarthak Kumar
//
// useAlgoController: orchestrates pathfinding algorithm playback for the toolbar.
// - Owns runs, not selections: the selected algorithm and speed preset live in useSettingsStore
//   and are read from there (never copied), so the two can't drift apart
// - Selected vs active: the active run is the one on screen. Changing the selection doesn't touch
//   it; a run in progress finishes (and Pause still pauses it), and the selection is picked up the
//   next time play/step/skipToEnd starts a run
// - Keeps the active runner (Map keyed by algorithm), tagged with the grid version it was built from
// - Invalidates/rebuilds the active run when the grid changes; instantly re-solves if it had finished
// - Speed changes apply to the active runner immediately, and to every runner created after
// - Wires runner events -> overlay canvas paints (paintAlgoEvent) and the final path animation
// - Status comes only from the runner (onStatusChange); controls never set it themselves
// - Exposes runAlgo (the active run's algorithm), status/pathLen/visitedApprox and
//   play/pause/step/skipToEnd/clear controls

import { useCallback, useEffect, useRef, useState } from 'react';
import { Callback } from '@/types/common';
import { AlgoMap, AlgoStatus, type AlgoEvent } from '@/types/algo';
import type { CanvasGridHandle } from '@/features/CanvasGrid';
import { useGridStore, useSettingsStore } from '@/features/store';
import { paintAlgoEvent, animateFinalPath } from '@/features/painters';

import { createRunner, RunnerApi } from './runner';
import { getGridSnapshot } from './utils';
import { GridSnapShot } from '@/types/grid';
import { speedToEPS } from '@/utils/settings';

export type AlgoController = {
    runAlgo: string;
    status: AlgoStatus | undefined; // undefined until the first run is created (idle)
    pathLen: number | undefined;
    visitedApprox: number;
    pathCost: number | undefined;

    clear: Callback;
    play: Callback;
    pause: Callback;
    step: Callback;
    skipToEnd: Callback;
};

type Options = {
    animatePath?: boolean; // default true (if false, path is drawn instantly)
    pathNps?: number; // nodes/sec for path trace if animating
};

type CachedRunner = { runner: RunnerApi<AlgoEvent>; buildVersion: number };

export function useAlgoController(
    gridRef: React.RefObject<CanvasGridHandle | null>,
    registry: AlgoMap, // keyed by label, the same key as useSettingsStore.algoKey
    opts: Options = {},
): AlgoController {
    const speed = useSettingsStore((s) => speedToEPS[s.speed]);
    const gridVersion = useGridStore((s) => s.gridVersion);

    const [currAlgo, setCurrAlgo] = useState(useSettingsStore.getState().algoKey);
    const [status, setStatus] = useState<AlgoStatus>();
    const [pathLen, setPathLen] = useState<number>();
    const [visitedApprox, setVisitedApprox] = useState<number>(0);
    const [pathCost, setPathCost] = useState<number>();

    const runners = useRef(new Map<string, CachedRunner>());

    const currentAlgoRef = useRef(currAlgo);
    const speedRef = useRef(speed);

    const cancelPathAnimRef = useRef<Callback>(() => {});
    const sawPathEventRef = useRef(false);

    useEffect(() => {
        const cached = runners.current.get(currentAlgoRef.current);
        if (cached) {
            cached.runner.setSpeed(speed);
        }
        speedRef.current = speed;
    }, [speed]);

    const getEventHandler = useCallback(
        (snap: GridSnapShot, instant: boolean): ((e: AlgoEvent) => void) => {
            const ctx = gridRef.current?.getOverlayCtx() ?? null;
            if (!ctx) {
                return () => {};
            }

            const { cellSize } = snap;
            return (event) => {
                const api = useGridStore.getState();

                paintAlgoEvent(ctx, cellSize, event, { drawPathInstant: instant });

                if (event.type === 'visit') setVisitedApprox((v) => v + 1);
                if (event.type === 'path') {
                    sawPathEventRef.current = true;
                    setPathLen(event.nodes.length);
                    setPathCost(event.cost);

                    api.setGridLock(false);

                    if (!instant && event.nodes.length) {
                        if (cancelPathAnimRef.current) {
                            cancelPathAnimRef.current();
                        }
                        cancelPathAnimRef.current = animateFinalPath(ctx, event.nodes, cellSize, opts.pathNps ?? 240);
                    }
                }
            };
        },
        [gridRef, opts],
    );

    const cleanupPreviousRun = useCallback(() => {
        const runner = runners.current.get(currentAlgoRef.current);
        if (!runner) {
            return;
        }
        runner.runner.pause();
        runners.current.delete(currentAlgoRef.current);
        if (cancelPathAnimRef.current) {
            cancelPathAnimRef.current();
        }
        if (gridRef.current) {
            gridRef.current.clearOverlay();
        }
        setVisitedApprox(0);
        setPathLen(undefined);
        setPathCost(undefined);
        sawPathEventRef.current = false;
    }, [gridRef]);

    const createRunnerFor = useCallback(
        (key: string, instant: boolean = opts.animatePath === false) => {
            const algo = registry[key];
            const snap = getGridSnapshot();
            if (!algo || !snap) return null;

            cleanupPreviousRun();

            const gen = algo(snap);

            const r = createRunner(gen, getEventHandler(snap, instant), {
                speed: speedRef.current,
                autoplay: false,
                onFinish: () => {
                    if (!sawPathEventRef.current) {
                        setPathLen(0);
                    }
                },
                onStatusChange: (s) => {
                    setStatus(s);
                },
            });

            runners.current.set(key, { runner: r, buildVersion: snap.gridVersion });
            setCurrAlgo(key);
            currentAlgoRef.current = key;
            // The runner only reports changes, so take its starting status here. This must stay after
            // cleanupPreviousRun: pausing the old runner reports "paused", and this (last) write wins.
            // Safe because a paused runner never reports again (its frame loop is cancelled).
            setStatus(r.getStatus());
            return r;
        },
        [getEventHandler, cleanupPreviousRun, opts, registry],
    );

    // The runner the controls act on. Keeps the active run while it is running (even if another
    // algorithm was selected meanwhile) or paused on the selected algorithm; otherwise starts a fresh
    // run of the selected algorithm (nothing cached, built for an older grid, finished, or a
    // non-running run of a previously selected algorithm). The selection is read with getState(),
    // not subscribed to: it should take effect when a control is used, not when the dropdown changes.
    const getOrCreateCurrent = useCallback(() => {
        const currAlgo = currentAlgoRef.current;
        const selectedAlgo = useSettingsStore.getState().algoKey;

        const cached = runners.current.get(currAlgo);
        if (!cached || cached.buildVersion !== gridVersion) {
            return createRunnerFor(selectedAlgo);
        }

        if (currAlgo === selectedAlgo) {
            return cached.runner.getStatus() === AlgoStatus.done ? createRunnerFor(currAlgo) : cached.runner;
        }

        return cached.runner.getStatus() === AlgoStatus.running ? cached.runner : createRunnerFor(selectedAlgo);
    }, [createRunnerFor, gridVersion]);

    // When the grid changes, rebuild the active run (not the selected one: the active run is what's
    // on screen) and skip to the end if it had finished
    useEffect(() => {
        const current = runners.current.get(currentAlgoRef.current);

        if (!current || current.buildVersion === gridVersion) {
            return;
        }

        const wasRunning = current.runner.getStatus() === AlgoStatus.running;
        const wasDone = current.runner.getStatus() === AlgoStatus.done;
        const r = createRunnerFor(currentAlgoRef.current, wasDone);
        if (wasRunning) {
            useGridStore.getState().setGridLock(false);
        }
        if (wasDone) {
            r?.skipToEnd();
        }
    }, [createRunnerFor, gridVersion]);

    // Controls operate on current runner -> can be sure the runner is upto date and created
    const play = useCallback(() => {
        const runner = getOrCreateCurrent();
        if (!runner) return;

        const api = useGridStore.getState();
        api.setGridLock(true);

        runner.play();
    }, [getOrCreateCurrent]);

    // acts on the active run only: there is nothing to pause in a run that doesn't exist yet, and
    // getOrCreateCurrent would replace a run that finished this frame (wiping its path)
    const pause = useCallback(() => {
        const runner = runners.current.get(currentAlgoRef.current)?.runner;
        if (!runner) return;

        const api = useGridStore.getState();
        api.setGridLock(false);

        runner.pause();
    }, []);

    const step = useCallback(() => {
        const runner = getOrCreateCurrent();
        if (!runner) return;
        const res = runner.step();
        if (res.done && !sawPathEventRef.current) {
            setPathLen(0);
        }
    }, [getOrCreateCurrent]);

    const skipToEnd = useCallback(() => {
        const runner = getOrCreateCurrent();
        if (!runner) return;
        runner.skipToEnd();

        const api = useGridStore.getState();
        api.setGridLock(false);

        if (!sawPathEventRef.current) setPathLen(0);
    }, [getOrCreateCurrent]);

    const clear = useCallback(() => {
        const currAlgo = useSettingsStore.getState().algoKey;
        createRunnerFor(currAlgo);
    }, [createRunnerFor]);

    // Cleanup on unmount
    const cleanup = () => {
        for (const r of runners.current.values()) r.runner.pause();
        cancelPathAnimRef.current?.();
        runners.current.clear();
    };
    useEffect(() => cleanup, []);

    return {
        runAlgo: currAlgo,
        status,
        pathLen,
        visitedApprox,
        pathCost,

        clear,
        play,
        pause,
        step,
        skipToEnd,
    };
}
