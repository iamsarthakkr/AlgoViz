import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { CanvasGrid, CanvasGridHandle } from '@/features/CanvasGrid';
import { useGridStore, useSettingsStore } from '@/features/store';
import { lightPalette } from '@/features/painters';
import { CellKind } from '@/types/grid';
import { DEFAULT_WEIGHT, WEIGHT_LEVELS } from '@/utils/constants';
import { MockCtx } from '../../helpers/canvas';
import { installFakeRaf } from '../../helpers/raf';

const CELL = 10;
const api = () => useGridStore.getState();

describe('CanvasGrid', () => {
    let raf: ReturnType<typeof installFakeRaf>;

    beforeEach(() => {
        raf = installFakeRaf();
        // jsdom has no pointer capture; the component logs and carries on
        vi.spyOn(console, 'error').mockImplementation(() => {});
        api().reset(5, 8, CELL);
        api().setStart(2, 1);
        api().setGoal(2, 6);
    });

    const setup = () => {
        const ref = createRef<CanvasGridHandle>();
        const utils = render(<CanvasGrid ref={ref} />);
        const surface = utils.container.firstChild as HTMLElement;
        // jsdom lays nothing out, so the surface sits at (0,0): client coords == grid pixels
        const at = (r: number, c: number) => ({ clientX: c * CELL + 5, clientY: r * CELL + 5, pointerId: 1 });
        return { ref, surface, at, ...utils };
    };

    it('sizes itself to the grid', () => {
        const { surface } = setup();
        expect(surface.style.width).toBe('80px');
        expect(surface.style.height).toBe('50px');
    });

    it('draws the base scene on the next frame', () => {
        const { ref } = setup();
        const base = ref.current!.getBaseCtx() as MockCtx;
        act(() => void raf.flush());
        expect(base.fills[0].style).toBe(lightPalette.background);
    });

    // weights is part of what CanvasGrid subscribes to; without it the terrain would only appear on
    // the next unrelated redraw
    it('redraws the base layer when a weight changes', () => {
        const { ref } = setup();
        const base = ref.current!.getBaseCtx() as MockCtx;
        act(() => void raf.flush());
        base.fills.length = 0;

        act(() => api().setWeight(0, 0, WEIGHT_LEVELS[0]));
        act(() => void raf.flush());
        expect(base.fills.map((f) => f.style)).toContain(lightPalette.weights[0]);
    });

    it('paints a wall on click and keeps painting while dragging', () => {
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, at(0, 0));
        fireEvent.pointerMove(surface, at(0, 1));
        fireEvent.pointerMove(surface, at(0, 2));
        fireEvent.pointerUp(surface, at(0, 2));
        fireEvent.pointerMove(surface, at(0, 3));

        expect([api().at(0, 0), api().at(0, 1), api().at(0, 2)]).toEqual(Array(3).fill(CellKind.wall));
        expect(api().at(0, 3)).toBe(CellKind.empty);
    });

    it('erases with the right mouse button or alt', () => {
        api().setWall(0, 0);
        api().setWall(0, 1);
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, { ...at(0, 0), button: 2 });
        fireEvent.pointerUp(surface, at(0, 0));
        fireEvent.pointerDown(surface, { ...at(0, 1), altKey: true });
        expect(api().at(0, 0)).toBe(CellKind.empty);
        expect(api().at(0, 1)).toBe(CellKind.empty);
    });

    // touch has no right button or alt, so the cell a drag starts on picks the brush
    describe('a drag that starts on a wall', () => {
        it('erases, for the whole drag', () => {
            [0, 1, 2].forEach((c) => api().setWall(0, c));
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, at(0, 0));
            fireEvent.pointerMove(surface, at(0, 1));
            fireEvent.pointerMove(surface, at(0, 2));
            fireEvent.pointerUp(surface, at(0, 2));

            expect([api().at(0, 0), api().at(0, 1), api().at(0, 2)]).toEqual(Array(3).fill(CellKind.empty));
        });

        // the brush is picked once per drag, so crossing empty cells doesn't flip it to drawing
        it('leaves empty cells it crosses empty', () => {
            api().setWall(0, 0);
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, at(0, 0));
            fireEvent.pointerMove(surface, at(0, 1));

            expect(api().at(0, 1)).toBe(CellKind.empty);
        });
    });

    it('a drag that starts on an empty cell draws over walls it crosses', () => {
        api().setWall(0, 1);
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, at(0, 0));
        fireEvent.pointerMove(surface, at(0, 1));
        fireEvent.pointerMove(surface, at(0, 2));

        expect([api().at(0, 0), api().at(0, 1), api().at(0, 2)]).toEqual(Array(3).fill(CellKind.wall));
    });

    // cells are a flat array, so (r, cols) would read (r + 1, 0): a wall there must not pick the eraser
    it('a drag starting just past the right edge draws, even if the next row starts with a wall', () => {
        const { cols } = api();
        api().setWall(1, 0);
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, at(0, cols));
        fireEvent.pointerMove(surface, at(0, cols - 1));

        expect(api().at(0, cols - 1)).toBe(CellKind.wall);
    });

    // The tool (Wall or a weight level) comes from the settings store. The erase rule is the same per
    // layer: a drag that starts on a cell matching the tool (or uses right-click/Alt) erases that layer.
    describe('with the weight tool', () => {
        const [LIGHT, MEDIUM, HEAVY] = WEIGHT_LEVELS;
        const weightAt = (r: number, c: number) => api().weights[api().idx(r, c)];
        const row0 = (n: number) => Array.from({ length: n }, (_, c) => weightAt(0, c));

        beforeEach(() => {
            useSettingsStore.getState().setTool({ type: 'weight', weight: MEDIUM });
        });

        // the first cell is painted on pointer down; the grid must count it as an edit right away
        it('a click paints the level and counts as an edit, without moving', () => {
            const { surface, at } = setup();
            const version = api().gridVersion;
            fireEvent.pointerDown(surface, at(0, 0));
            expect(weightAt(0, 0)).toBe(MEDIUM);
            expect(api().gridVersion).toBeGreaterThan(version);
        });

        it('a drag paints every plain cell it crosses', () => {
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, at(0, 0));
            fireEvent.pointerMove(surface, at(0, 1));
            fireEvent.pointerMove(surface, at(0, 2));
            expect(row0(3)).toEqual([MEDIUM, MEDIUM, MEDIUM]);
        });

        it('a drag that starts on the same level erases every weight it crosses', () => {
            [0, 1].forEach((c) => api().setWeight(0, c, MEDIUM));
            api().setWeight(0, 2, LIGHT);
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, at(0, 0));
            fireEvent.pointerMove(surface, at(0, 1));
            fireEvent.pointerMove(surface, at(0, 2));
            expect(row0(3)).toEqual([DEFAULT_WEIGHT, DEFAULT_WEIGHT, DEFAULT_WEIGHT]);
        });

        // changing a cell's level must not take an erase drag first
        it('a drag that starts on a different level paints over it', () => {
            api().setWeight(0, 0, LIGHT);
            api().setWeight(0, 1, HEAVY);
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, at(0, 0));
            fireEvent.pointerMove(surface, at(0, 1));
            expect(row0(2)).toEqual([MEDIUM, MEDIUM]);
        });

        it('skips walls instead of turning them into terrain', () => {
            api().setWall(0, 1);
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, at(0, 0));
            fireEvent.pointerMove(surface, at(0, 1));
            fireEvent.pointerMove(surface, at(0, 2));
            expect(api().at(0, 1)).toBe(CellKind.wall);
            expect(row0(3)).toEqual([MEDIUM, DEFAULT_WEIGHT, MEDIUM]);
        });

        it('right-click or Alt erases weights', () => {
            api().setWeight(0, 0, HEAVY);
            api().setWeight(0, 2, LIGHT);
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, { ...at(0, 0), button: 2 });
            fireEvent.pointerUp(surface, at(0, 0));
            fireEvent.pointerDown(surface, { ...at(0, 2), altKey: true });
            expect(row0(3)).toEqual([DEFAULT_WEIGHT, DEFAULT_WEIGHT, DEFAULT_WEIGHT]);
        });

        it('never paints over the markers', () => {
            const { start } = api();
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, at(start.r - 1, start.c));
            fireEvent.pointerMove(surface, at(start.r, start.c));
            expect(weightAt(start.r, start.c)).toBe(DEFAULT_WEIGHT);
        });
    });

    it('the wall tool paints over terrain, dropping its weight', () => {
        api().setWeight(0, 0, WEIGHT_LEVELS[WEIGHT_LEVELS.length - 1]);
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, at(0, 0));
        expect(api().at(0, 0)).toBe(CellKind.wall);
        expect(api().weights[api().idx(0, 0)]).toBe(DEFAULT_WEIGHT);
    });

    // gridVersion is the "grid changed" signal: each bump re-renders and makes the controller re-solve a
    // finished run. pointermove fires many times per cell, so it must only bump when a cell really changed.
    describe('gridVersion bumps only for real changes', () => {
        it('painting one new cell bumps it exactly once', () => {
            const { surface, at } = setup();
            const version = api().gridVersion;
            fireEvent.pointerDown(surface, at(0, 0));
            expect(api().gridVersion).toBe(version + 1);
        });

        it('moving within the same cell does not bump it again', () => {
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, at(0, 0));
            const version = api().gridVersion;
            for (let dx = 1; dx < CELL / 2; dx++) {
                const p = at(0, 0);
                fireEvent.pointerMove(surface, { ...p, clientX: p.clientX - dx });
            }
            expect(api().gridVersion).toBe(version);
        });

        it('dragging over cells that are already walls does not bump it', () => {
            api().setWall(0, 1);
            api().setWall(0, 2);
            const { surface, at } = setup();
            fireEvent.pointerDown(surface, at(0, 0));
            const version = api().gridVersion;
            fireEvent.pointerMove(surface, at(0, 1));
            fireEvent.pointerMove(surface, at(0, 2));
            expect(api().gridVersion).toBe(version);
        });

        // a finished run must re-solve when its start or goal moves
        it('moving a marker to a new cell bumps it', () => {
            const { start } = api();
            const { surface, at } = setup();
            const version = api().gridVersion;
            fireEvent.pointerDown(surface, at(start.r, start.c));
            fireEvent.pointerMove(surface, at(start.r + 1, start.c));
            expect(api().start).toEqual({ r: start.r + 1, c: start.c });
            expect(api().gridVersion).toBeGreaterThan(version);
        });

        it('holding a marker still does not bump it', () => {
            const { start } = api();
            const { surface, at } = setup();
            const version = api().gridVersion;
            fireEvent.pointerDown(surface, at(start.r, start.c));
            fireEvent.pointerMove(surface, at(start.r, start.c));
            fireEvent.pointerMove(surface, at(start.r, start.c));
            expect(api().gridVersion).toBe(version);
        });
    });

    it('drags the start and goal markers instead of painting over them', () => {
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, at(2, 1));
        fireEvent.pointerMove(surface, at(4, 0));
        fireEvent.pointerUp(surface, at(4, 0));
        expect(api().start).toEqual({ r: 4, c: 0 });

        fireEvent.pointerDown(surface, at(2, 6));
        fireEvent.pointerMove(surface, at(0, 7));
        fireEvent.pointerLeave(surface, at(0, 7));
        expect(api().goal).toEqual({ r: 0, c: 7 });
        expect(api().cells.every((k) => k === CellKind.empty)).toBe(true);
    });

    // regression: negative coords used to mean "hide the marker". Pointer capture keeps sending moves
    // past the canvas, so dragging a marker beyond the corner made it vanish
    it('dragging a marker past the top-left corner clamps it to the corner', () => {
        const { start } = api();
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, at(start.r, start.c));
        fireEvent.pointerMove(surface, at(-1, -1));
        expect(api().start).toEqual({ r: 0, c: 0 });
    });

    it('dragging a marker past an edge clamps it to that edge', () => {
        const { start } = api();
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, at(start.r, start.c));
        fireEvent.pointerMove(surface, at(-1, start.c));
        expect(api().start).toEqual({ r: 0, c: start.c });
    });

    it('ignores pointer input outside the grid', () => {
        const { surface, at } = setup();
        const before = api().cells;
        fireEvent.pointerDown(surface, at(9, 9));
        expect(api().cells).toBe(before);
    });

    it('ignores all editing while the grid is locked', () => {
        api().setGridLock(true);
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, at(0, 0));
        fireEvent.pointerMove(surface, at(0, 1));
        expect(api().at(0, 0)).toBe(CellKind.empty);
        expect(api().at(0, 1)).toBe(CellKind.empty);
    });

    it('stops painting once the pointer is cancelled', () => {
        const { surface, at } = setup();
        fireEvent.pointerDown(surface, at(0, 0));
        fireEvent.pointerCancel(surface, at(0, 0));
        fireEvent.pointerMove(surface, at(0, 1));

        expect(api().at(0, 0)).toBe(CellKind.wall);
        expect(api().at(0, 1)).toBe(CellKind.empty);
    });

    it('bumps gridVersion on edits so cached algorithm runs are invalidated', () => {
        const { surface, at } = setup();
        const version = api().gridVersion;
        fireEvent.pointerDown(surface, at(0, 0));
        expect(api().gridVersion).toBeGreaterThan(version);
    });

    it('suppresses the browser context menu', () => {
        const { surface } = setup();
        expect(fireEvent.contextMenu(surface)).toBe(false);
    });

    it('handle: clearOverlay clears the overlay and redrawBase repaints the base', () => {
        const { ref } = setup();
        const overlay = ref.current!.getOverlayCtx() as MockCtx;
        const base = ref.current!.getBaseCtx() as MockCtx;
        ref.current!.clearOverlay();
        expect(overlay.clearRect).toHaveBeenCalledWith(0, 0, 80, 50);
        base.fills.length = 0;
        ref.current!.redrawBase();
        expect(base.fills.length).toBeGreaterThan(0);
    });

    it('claims touch gestures so dragging paints instead of scrolling', () => {
        const { surface } = setup();
        expect(surface).toHaveStyle({ touchAction: 'none' });
    });
});
