import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMazeGenerator } from '@/features/animations/useMazeGenerator';
import { useGridStore } from '@/features/store';
import { CellKind } from '@/types/grid';
import { mazes } from '@/features/mazes';
import { MazeGenerator } from '@/types/mazeGenerator';
import { DEFAULT_WEIGHT, WEIGHT_LEVELS } from '@/utils/constants';
import { installFakeRaf } from '../../helpers/raf';
import { seedRandom } from '../../helpers/random';

// Deterministic generator exercising every event type
const scripted: MazeGenerator = function* () {
    yield { type: 'fill-wall' };
    yield { type: 'carve', at: { r: 1, c: 1 } };
    yield { type: 'clear-wall' };
    yield { type: 'wall', at: { r: 0, c: 0 } };
    yield { type: 'wall', at: { r: 0, c: 1 } };
    yield { type: 'done' };
};

const api = () => useGridStore.getState();

describe('useMazeGenerator', () => {
    let raf: ReturnType<typeof installFakeRaf>;
    beforeEach(() => {
        raf = installFakeRaf();
        api().reset(5, 5);
        api().setStart(2, 1);
        api().setGoal(2, 3);
    });

    const render = () => renderHook(() => useMazeGenerator({ scripted }, { speed: 60 }));

    it('locks the grid and hides the markers while generating', () => {
        const { result } = render();
        act(() => result.current.generate('scripted'));
        expect(api().gridLock).toBe(true);
        expect(api().markersHidden).toBe(true);
    });

    it('writes each event into the grid store', () => {
        const { result } = render();
        act(() => result.current.generate('scripted'));
        raf.frame(); // fill-wall
        expect(api().cells.every((k) => k === CellKind.wall)).toBe(true);
        raf.frame(); // carve
        expect(api().at(1, 1)).toBe(CellKind.empty);
        raf.frame(); // clear-wall
        raf.frame(); // wall
        raf.frame(); // wall
        expect(api().at(0, 0)).toBe(CellKind.wall);
        expect(api().at(0, 1)).toBe(CellKind.wall);
        expect(api().at(4, 4)).toBe(CellKind.empty);
    });

    it('restores the markers, unlocks and bumps gridVersion when done', () => {
        const { result } = render();
        const version = api().gridVersion;
        act(() => result.current.generate('scripted'));
        raf.flush();
        expect(api().start).toEqual({ r: 2, c: 1 });
        expect(api().goal).toEqual({ r: 2, c: 3 });
        expect(api().gridLock).toBe(false);
        expect(api().gridVersion).toBe(version + 1);
    });

    it('starting a new maze mid-run cancels the old one and restores markers first', () => {
        const { result } = render();
        act(() => result.current.generate('scripted'));
        raf.frame();
        act(() => result.current.generate('scripted'));
        raf.flush();
        expect(api().start).toEqual({ r: 2, c: 1 });
        expect(api().goal).toEqual({ r: 2, c: 3 });
        expect(api().gridLock).toBe(false);
    });

    it('ignores unknown generator keys', () => {
        const { result } = render();
        act(() => result.current.generate('missing'));
        expect(api().gridLock).toBe(false);
        expect(raf.pending()).toBe(0);
    });

    it('does nothing while the markers are hidden', () => {
        api().hideMarkers();
        const { result } = render();
        act(() => result.current.generate('scripted'));
        expect(api().gridLock).toBe(false);
    });

    // Markers keep their coordinates while hidden, but a maze must behave as if they weren't there, and
    // when it ends they must land on open cells, or the goal can't be reached and every run says "No path"
    describe('markers and the finished maze', () => {
        const generate = (gen: MazeGenerator) => {
            const { result } = renderHook(() => useMazeGenerator({ gen }, { speed: 60 }));
            act(() => result.current.generate('gen'));
            act(() => void raf.flush());
        };
        const isOpen = ({ r, c }: { r: number; c: number }) => api().at(r, c) === CellKind.empty;

        it('shows the markers again when done', () => {
            generate(scripted);
            expect(api().markersHidden).toBe(false);
        });

        it('draws maze walls through the hidden markers cells', () => {
            const { start } = api();
            generate(function* () {
                yield { type: 'clear-wall' };
                yield { type: 'wall', at: start };
                yield { type: 'done' };
            });
            expect(api().at(start.r, start.c)).toBe(CellKind.wall);
        });

        it('moves a marker walled over by the maze to the nearest open cell', () => {
            generate(function* () {
                yield { type: 'fill-wall' };
                yield { type: 'carve', at: { r: 1, c: 1 } }; // beside the start
                yield { type: 'carve', at: { r: 1, c: 3 } }; // beside the goal
                yield { type: 'done' };
            });
            expect(api().start).toEqual({ r: 1, c: 1 });
            expect(api().goal).toEqual({ r: 1, c: 3 });
        });

        // both markers' nearest open cell is (2,2): the goal must not be left on a wall or on the start
        it('keeps the markers apart when they would land on the same cell', () => {
            generate(function* () {
                yield { type: 'fill-wall' };
                yield { type: 'carve', at: { r: 2, c: 2 } };
                yield { type: 'carve', at: { r: 0, c: 0 } };
                yield { type: 'done' };
            });
            const { start, goal } = api();
            expect(isOpen(start) && isOpen(goal)).toBe(true);
            expect(start).not.toEqual(goal);
        });

        // even coordinates: the lattice mazes keep walls there, so a marker dragged onto one gets walled over
        it.each(Object.keys(mazes))('leaves both markers on open cells after %s', (key) => {
            seedRandom(7);
            api().reset(15, 21);
            api().setStart(2, 2);
            api().setGoal(12, 18);
            const { result } = renderHook(() => useMazeGenerator(mazes, { speed: 6000 }));
            act(() => result.current.generate(key));
            act(() => void raf.flush());
            expect(isOpen(api().start)).toBe(true);
            expect(isOpen(api().goal)).toBe(true);
            expect(api().start).not.toEqual(api().goal);
        });

        // Decision: a wall maze is a fresh board. Every registered maze starts with fill-wall or
        // clear-wall; only fillWalls drops weights by itself, so a clear-wall maze must too.
        it.each(Object.keys(mazes))('%s starts from a board with no weights', (key) => {
            seedRandom(7);
            api().reset(15, 21);
            api().setWeight(1, 1, WEIGHT_LEVELS[0]);
            api().setWeight(2, 2, WEIGHT_LEVELS[2]);
            const { result } = renderHook(() => useMazeGenerator(mazes, { speed: 6000 }));
            act(() => result.current.generate(key));
            act(() => void raf.flush());
            expect(api().weights.every((w) => w === DEFAULT_WEIGHT)).toBe(true);
        });
    });
});
