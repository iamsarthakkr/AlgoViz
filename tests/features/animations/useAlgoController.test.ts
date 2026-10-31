import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAlgoController } from '@/features/animations';
import type { CanvasGridHandle } from '@/features/CanvasGrid';
import { useGridStore, useSettingsStore } from '@/features/store';
import { bfs } from '@/features/algo/bfs';
import { dfs } from '@/features/algo/dfs';
import { lightPalette } from '@/features/painters';
import { AlgoStatus } from '@/types/algo';
import { createMockCtx, MockCtx } from '../../helpers/canvas';
import { installFakeRaf } from '../../helpers/raf';

const registry = { BFS: bfs, DFS: dfs };

// 5x5 open grid, start (2,0) → goal (2,4): the shortest path is the 5 cells of the middle row
const BFS_PATH = 5;
function setupGrid() {
    const api = useGridStore.getState();
    api.reset(5, 5);
    api.setStart(2, 0);
    api.setGoal(2, 4);
}

const select = (key: string) => act(() => useSettingsStore.getState().setAlgoKey(key));

describe('useAlgoController', () => {
    let raf: ReturnType<typeof installFakeRaf>;
    let overlay: MockCtx;
    let gridRef: { current: CanvasGridHandle };

    beforeEach(() => {
        raf = installFakeRaf();
        setupGrid();
        // the controller reads the selection from the store; the registry here uses short keys
        useSettingsStore.getState().setAlgoKey('BFS');
        overlay = createMockCtx();
        gridRef = {
            current: {
                getBaseCtx: () => null,
                getOverlayCtx: () => overlay,
                clearOverlay: vi.fn(),
                redrawBase: vi.fn(),
            },
        };
    });

    const render = (opts?: Parameters<typeof useAlgoController>[2]) =>
        renderHook(() => useAlgoController(gridRef, registry, opts));

    const flush = () => act(() => void raf.flush());
    const frame = () => act(() => void raf.frame());
    const pathFills = () => overlay.fills.filter((f) => f.style === lightPalette.pathCell);
    const locked = () => useGridStore.getState().gridLock;

    // how many cells a finished run of `key` visits on the current grid
    function visitsOfFullRun(key: 'BFS' | 'DFS') {
        const { result, unmount } = renderHook(() => useAlgoController(gridRef, registry));
        select(key);
        act(() => result.current.skipToEnd());
        const visited = result.current.visitedApprox;
        unmount();
        return visited;
    }

    it('starts idle, showing the selected algorithm', () => {
        const { result } = render();
        expect(result.current.status).toBeUndefined();
        expect(result.current.runAlgo).toBe('BFS');
        expect(result.current.pathLen).toBeUndefined();
    });

    // the runner finishing on its own (not via step/skipToEnd) must still report done,
    // or the toolbar stays stuck on Pause with Visualize disabled
    it('play locks the grid, animates to completion, then reports done, unlocks and reports the path', () => {
        const { result } = render();
        act(() => result.current.play());
        expect(result.current.status).toBe(AlgoStatus.running);
        expect(locked()).toBe(true);

        flush();
        expect(result.current.status).toBe(AlgoStatus.done);
        expect(result.current.pathLen).toBe(BFS_PATH);
        expect(result.current.visitedApprox).toBeGreaterThan(0);
        expect(locked()).toBe(false);
        expect(pathFills()).toHaveLength(BFS_PATH);
    });

    // Strict Mode runs the unmount cleanup then remounts with the same refs; a cleanup that blanked
    // the active key made Visualize do nothing until an algorithm was picked from the dropdown
    it('plays the selected algorithm under Strict Mode', () => {
        const { result } = renderHook(() => useAlgoController(gridRef, registry), { reactStrictMode: true });
        act(() => result.current.play());
        flush();
        expect(result.current.status).toBe(AlgoStatus.done);
        expect(result.current.pathLen).toBe(BFS_PATH);
    });

    describe('pause', () => {
        it('stops the run and releases the grid lock', () => {
            const { result } = render();
            act(() => result.current.play());
            frame();
            act(() => result.current.pause());
            expect(result.current.status).toBe(AlgoStatus.paused);
            expect(locked()).toBe(false);

            const fills = overlay.fills.length;
            flush();
            expect(overlay.fills).toHaveLength(fills);
        });

        it('does nothing before any run exists', () => {
            const { result } = render();
            act(() => result.current.pause());
            expect(result.current.status).toBeUndefined();
            expect(gridRef.current.clearOverlay).not.toHaveBeenCalled();
        });

        // pause must not go through "get or create": a finished run would be replaced by a new one
        it('leaves a finished run (and its path) alone', () => {
            const { result } = render({ animatePath: false });
            act(() => result.current.skipToEnd());
            vi.mocked(gridRef.current.clearOverlay).mockClear();

            act(() => result.current.pause());
            expect(result.current.status).toBe(AlgoStatus.done);
            expect(result.current.pathLen).toBe(BFS_PATH);
            expect(gridRef.current.clearOverlay).not.toHaveBeenCalled();
        });
    });

    it('step advances one event at a time until done', () => {
        const { result } = render();
        act(() => result.current.step());
        expect(result.current.status).toBe(AlgoStatus.paused);
        for (let i = 0; i < 100 && result.current.status !== AlgoStatus.done; i++) act(() => result.current.step());
        expect(result.current.status).toBe(AlgoStatus.done);
        expect(result.current.pathLen).toBe(BFS_PATH);
    });

    it('skipToEnd finishes immediately', () => {
        const { result } = render();
        act(() => result.current.skipToEnd());
        expect(result.current.status).toBe(AlgoStatus.done);
        expect(result.current.pathLen).toBe(BFS_PATH);
        expect(locked()).toBe(false);
    });

    it('reports a path length of 0 when the goal is unreachable', () => {
        const api = useGridStore.getState();
        for (let r = 0; r < 5; r++) api.setWall(r, 2);
        const { result } = render();
        act(() => result.current.skipToEnd());
        expect(result.current.status).toBe(AlgoStatus.done);
        expect(result.current.pathLen).toBe(0);
    });

    it('does nothing while the markers are hidden', () => {
        useGridStore.getState().hideMarkers();
        const { result } = render();
        act(() => result.current.play());
        expect(result.current.status).toBeUndefined();
        expect(locked()).toBe(false);
    });

    it('is a no-op when the selected algorithm is not in the registry', () => {
        const { result } = render();
        select('missing');
        act(() => result.current.play());
        expect(result.current.status).toBeUndefined();
        expect(locked()).toBe(false);
    });

    it('play after a finished run starts a new run', () => {
        const { result } = render();
        act(() => result.current.skipToEnd());
        act(() => result.current.play());
        expect(result.current.status).toBe(AlgoStatus.running);
        expect(result.current.pathLen).toBeUndefined();
    });

    describe('clear', () => {
        it('wipes the overlay and stats and leaves a fresh run ready', () => {
            const { result } = render();
            act(() => result.current.skipToEnd());
            act(() => result.current.clear());
            expect(gridRef.current.clearOverlay).toHaveBeenCalled();
            expect(result.current.status).toBe(AlgoStatus.initial);
            expect(result.current.pathLen).toBeUndefined();
            expect(result.current.visitedApprox).toBe(0);
        });

        // the paused runner used to stay cached, so Visualize resumed it mid-way on a blank overlay
        // (with the visited count restarted from 0)
        it('after a pause, Visualize starts over instead of resuming', () => {
            const fullRun = visitsOfFullRun('BFS');
            const { result } = render();
            act(() => result.current.play());
            frame();
            act(() => result.current.pause());
            act(() => result.current.clear());

            act(() => result.current.play());
            flush();
            expect(result.current.status).toBe(AlgoStatus.done);
            expect(result.current.visitedApprox).toBe(fullRun);
        });

        it('picks up a newly selected algorithm', () => {
            const { result } = render();
            act(() => result.current.skipToEnd());
            select('DFS');
            act(() => result.current.clear());
            expect(result.current.runAlgo).toBe('DFS');
        });
    });

    // The dropdown only changes the selection; the run on screen (the active run) is left alone until
    // a control starts a new run
    describe('changing the selected algorithm', () => {
        it('is used by the next run', () => {
            const { result } = render();
            select('DFS');
            act(() => result.current.skipToEnd());
            expect(result.current.runAlgo).toBe('DFS');
            // DFS hugs the top edge first on an open grid, so its path is longer than BFS's
            expect(result.current.pathLen).toBeGreaterThan(BFS_PATH);
        });

        it('mid-run, lets the running run finish as it was', () => {
            const { result } = render();
            act(() => result.current.play());
            frame();
            select('DFS');

            flush();
            expect(result.current.runAlgo).toBe('BFS');
            expect(result.current.status).toBe(AlgoStatus.done);
            expect(result.current.pathLen).toBe(BFS_PATH);
            expect(locked()).toBe(false);
        });

        it('mid-run, Pause still pauses the running run', () => {
            const { result } = render();
            act(() => result.current.play());
            frame();
            select('DFS');

            act(() => result.current.pause());
            expect(result.current.runAlgo).toBe('BFS');
            expect(result.current.status).toBe(AlgoStatus.paused);
            expect(locked()).toBe(false);

            const fills = overlay.fills.length;
            flush();
            expect(overlay.fills).toHaveLength(fills);
        });

        // Visualize is disabled while running, but the controller must not rely on that
        it('mid-run, play keeps the running run instead of starting the new algorithm', () => {
            const { result } = render();
            act(() => result.current.play());
            frame();
            select('DFS');
            vi.mocked(gridRef.current.clearOverlay).mockClear();

            act(() => result.current.play());
            expect(result.current.runAlgo).toBe('BFS');
            expect(result.current.status).toBe(AlgoStatus.running);
            expect(gridRef.current.clearOverlay).not.toHaveBeenCalled();
        });

        it('while paused, Visualize discards the paused run and starts the new algorithm', () => {
            const { result } = render();
            act(() => result.current.play());
            frame();
            act(() => result.current.pause());
            select('DFS');
            vi.mocked(gridRef.current.clearOverlay).mockClear();

            act(() => result.current.play());
            expect(gridRef.current.clearOverlay).toHaveBeenCalled();
            expect(result.current.runAlgo).toBe('DFS');
            expect(result.current.status).toBe(AlgoStatus.running);
            flush();
            expect(result.current.pathLen).toBeGreaterThan(BFS_PATH);
        });

        it('while paused, Step starts the new algorithm', () => {
            const { result } = render();
            act(() => result.current.step());
            select('DFS');

            act(() => result.current.step());
            expect(result.current.runAlgo).toBe('DFS');
            expect(result.current.status).toBe(AlgoStatus.paused);
        });

        // what's on screen is the active run, so a grid edit re-solves that one
        it('after a finished run, a grid edit re-solves the active algorithm, not the selected one', () => {
            const { result } = render();
            act(() => result.current.skipToEnd());
            select('DFS');

            act(() => {
                useGridStore.getState().setWall(2, 2);
                useGridStore.getState().refresh();
            });
            expect(result.current.runAlgo).toBe('BFS');
            expect(result.current.status).toBe(AlgoStatus.done);
            // BFS around the single wall: 2 cells longer than the straight line
            expect(result.current.pathLen).toBe(BFS_PATH + 2);
        });
    });

    // The speed preset lives in the settings store; the controller applies it from there
    describe('speed', () => {
        const fillsInOneFrame = () => {
            const before = overlay.fills.length;
            frame();
            return overlay.fills.length - before;
        };

        it('a change applies to the running run immediately', () => {
            useSettingsStore.getState().setSpeed('slow');
            const { result } = render();
            act(() => result.current.play());
            const slow = fillsInOneFrame();

            act(() => useSettingsStore.getState().setSpeed('fast'));
            expect(fillsInOneFrame()).toBeGreaterThan(slow);
        });

        it('new runs start at the current speed', () => {
            useSettingsStore.getState().setSpeed('slow');
            const slowRun = render();
            act(() => slowRun.result.current.play());
            const slow = fillsInOneFrame();
            slowRun.unmount();

            overlay.fills.length = 0;
            useSettingsStore.getState().setSpeed('fast');
            const fastRun = render();
            act(() => fastRun.result.current.play());
            expect(fillsInOneFrame()).toBeGreaterThan(slow);
        });
    });

    // Editing walls after a finished run re-solves instantly so the path stays in sync
    it('re-solves instantly when the grid changes after a finished run', () => {
        const { result } = render();
        act(() => result.current.skipToEnd());

        act(() => {
            useGridStore.getState().setWall(2, 2);
            useGridStore.getState().refresh();
        });
        expect(result.current.status).toBe(AlgoStatus.done);
        expect(result.current.pathLen).toBe(BFS_PATH + 2);
    });

    it('rebuilds (without solving) when the grid changes mid-run', () => {
        const { result } = render();
        act(() => result.current.step());
        act(() => useGridStore.getState().refresh());
        expect(result.current.status).toBe(AlgoStatus.initial);
        expect(result.current.pathLen).toBeUndefined();
    });

    // A resize bumps gridVersion (the overlay was wiped and the snapshot's cellSize is stale), so a
    // running run is abandoned. play() took the grid lock, so the rebuild must give it back.
    describe('when the grid is resized', () => {
        const resize = () => act(() => useGridStore.getState().resize(useGridStore.getState().cellSize + 1));

        it('re-solves a finished run instantly at the new size', () => {
            const { result } = render();
            act(() => result.current.skipToEnd());
            resize();
            expect(result.current.status).toBe(AlgoStatus.done);
            expect(result.current.pathLen).toBe(BFS_PATH);
        });

        // the rebuild pauses the old runner first; its "paused" report must not become the new
        // run's status
        it('stops a running run, shows the new run as ready and releases the grid lock it took', () => {
            const { result } = render();
            act(() => result.current.play());
            frame();
            expect(result.current.status).toBe(AlgoStatus.running);
            expect(locked()).toBe(true);

            resize();
            expect(result.current.status).toBe(AlgoStatus.initial);
            expect(result.current.pathLen).toBeUndefined();
            expect(locked()).toBe(false);
        });

        it('can be played again after a run was stopped by a resize', () => {
            const { result } = render();
            act(() => result.current.play());
            frame();
            resize();

            act(() => result.current.play());
            flush();
            expect(result.current.status).toBe(AlgoStatus.done);
            expect(result.current.pathLen).toBe(BFS_PATH);
        });

        // gridLock is shared with the maze generator: a resize mid-maze must not let the user paint
        it('does not release a lock held by someone else (maze generation)', () => {
            const { result } = render();
            act(() => result.current.clear()); // leaves a fresh, idle runner, as onGenerateMaze does
            act(() => useGridStore.getState().setGridLock(true));

            resize();
            expect(locked()).toBe(true);
        });
    });

    it('stops playback on unmount', () => {
        const { result, unmount } = render();
        act(() => result.current.play());
        const fillsBefore = overlay.fills.length;
        unmount();
        raf.flush();
        expect(overlay.fills.length).toBe(fillsBefore);
    });

    it('animatePath: false draws the path instantly', () => {
        const { result } = render({ animatePath: false });
        act(() => result.current.skipToEnd());
        expect(pathFills()).toHaveLength(BFS_PATH);
    });

    it('animates the path by default: nothing drawn until frames run', () => {
        const { result } = render();
        act(() => result.current.skipToEnd());
        expect(pathFills()).toHaveLength(0);
        flush();
        expect(pathFills()).toHaveLength(BFS_PATH);
    });
});
