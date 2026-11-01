import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Grid from '@/ui/Grid';
import { useGridStore, useSettingsStore } from '@/features/store';
import { lightPalette } from '@/features/painters';
import { mazeRegistry } from '@/features/mazes';
import { algoLabels } from '@/features/algo';
import { CellKind } from '@/types/grid';
import { DEFAULT_WEIGHT, WEIGHT_LEVELS } from '@/utils/constants';
import { MockCtx } from '../helpers/canvas';
import { installFakeRaf } from '../helpers/raf';
import { seedRandom } from '../helpers/random';

const callOrder = (fn: unknown) => vi.mocked(fn as () => void).mock.invocationCallOrder;

// What is visible on the overlay now: the path cells painted since it was last cleared
// (a clearRect, or a canvas resize, which tests/setup.ts records as one)
function pathOnScreen(overlay: MockCtx) {
    const lastClear = Math.max(0, ...callOrder(overlay.clearRect));
    const fillOrder = callOrder(overlay.fillRect);
    return overlay.fills.filter((f, i) => f.style === lightPalette.pathCell && fillOrder[i] > lastClear);
}

// default grid has no walls, so the path is a straight line along the middle row
function expectedPathLength() {
    const { start, goal } = useGridStore.getState();
    return Math.abs(goal.c - start.c) + 1;
}

describe('Grid page', () => {
    let raf: ReturnType<typeof installFakeRaf>;
    beforeEach(() => {
        raf = installFakeRaf();
    });

    // The layout (index.css .page) places each piece by grid area and only the area map changes per
    // breakpoint, so every piece must exist exactly once. jsdom ignores CSS, so this checks structure;
    // the visual layout is checked by hand in device mode.
    describe('page structure', () => {
        it('renders each layout area exactly once', () => {
            render(<Grid />);
            expect(screen.getAllByRole('banner')).toHaveLength(1);
            expect(screen.getAllByRole('main')).toHaveLength(1);
            expect(screen.getAllByRole('complementary', { name: 'Legend' })).toHaveLength(1);
            expect(screen.getAllByRole('complementary', { name: 'Stats' })).toHaveLength(1);
        });

        // rendering the controls once per breakpoint (hiding one copy) would duplicate every button
        it('renders the playback controls once, outside the header', () => {
            render(<Grid />);
            expect(screen.getAllByRole('button', { name: 'Visualize' })).toHaveLength(1);
            expect(within(screen.getByRole('banner')).queryByRole('button', { name: 'Visualize' })).toBeNull();
        });

        it('puts both grid canvases inside main', () => {
            render(<Grid />);
            expect(screen.getByRole('main').querySelectorAll('canvas')).toHaveLength(2);
        });
    });

    // the legend's palette and the grid share the settings store's tool
    it('picking a weight in the legend makes the grid paint that weight', async () => {
        render(<Grid />);
        const medium = WEIGHT_LEVELS[1];
        await userEvent.click(screen.getByRole('button', { name: new RegExp(`cost ${medium}$`) }));
        expect(useSettingsStore.getState().tool).toEqual({ type: 'weight', weight: medium });
        expect(screen.getByRole('button', { name: new RegExp(`cost ${medium}$`) })).toHaveAttribute(
            'aria-pressed',
            'true',
        );

        // CanvasGrid's wrapper (the element with the pointer handlers) wraps the canvas stage
        const surface = screen.getByRole('main').querySelector('canvas')!.parentElement!.parentElement!;
        const { cellSize } = useGridStore.getState();
        fireEvent.pointerDown(surface, { clientX: cellSize / 2, clientY: cellSize / 2, pointerId: 1 });
        expect(useGridStore.getState().weights[0]).toBe(medium);
    });

    // the default algorithm ignores weights, which only matters once the grid has some
    it('turns the algorithm note red once the grid has weights, and back when they are gone', () => {
        render(<Grid />);
        const note = () => screen.getByRole('complementary', { name: 'Stats' }).querySelector('p')!;
        expect(note()).not.toHaveClass('text-red-700');

        act(() => void useGridStore.getState().setWeight(0, 0, WEIGHT_LEVELS[0]));
        expect(note()).toHaveClass('text-red-700');

        act(() => void useGridStore.getState().clearWeights());
        expect(note()).not.toHaveClass('text-red-700');
    });

    // the toolbar's info button and the InfoModal share the page's open state (useInfoModal)
    describe('info dialog', () => {
        const infoDialog = () => screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;
        const infoButton = () => screen.getByRole('button', { name: 'About AlgoViz' });

        it('opens on a first visit, and the header button reopens it after it is closed', async () => {
            render(<Grid />);
            expect(infoDialog().open).toBe(true);

            // jsdom doesn't submit <form method="dialog">, so close the way the browser would
            act(() => infoDialog().close());
            expect(infoDialog().open).toBe(false);

            // the page heard the close: the button opens it again
            await userEvent.click(infoButton());
            expect(infoDialog().open).toBe(true);
        });

        it('stays closed for a returning visitor until the header button is pressed', async () => {
            const first = render(<Grid />);
            act(() => infoDialog().close());
            first.unmount();

            render(<Grid />);
            expect(infoDialog().open).toBe(false);
            await userEvent.click(infoButton());
            expect(infoDialog().open).toBe(true);
        });
    });

    const renderAndVisualize = async () => {
        render(<Grid />);
        const overlay = screen.getByRole('main').querySelectorAll('canvas')[1].getContext('2d') as unknown as MockCtx;

        await userEvent.click(screen.getByRole('button', { name: 'Visualize' }));
        act(() => void raf.flush());
        return overlay;
    };

    // End to end: Visualize runs the default algorithm and traces the path on the overlay
    it('visualizes a path from start to goal on the overlay canvas', async () => {
        const overlay = await renderAndVisualize();
        expect(pathOnScreen(overlay)).toHaveLength(expectedPathLength());
    });

    it('shows the finished run in the stats panel', async () => {
        await renderAndVisualize();
        const stats = within(screen.getByRole('complementary', { name: 'Stats' }));
        const value = (label: string) => stats.getByText(label, { selector: 'dt' }).nextElementSibling;

        expect(value('Algo')).toHaveTextContent(algoLabels[0]);
        expect(value('Status')).toHaveTextContent('Finished');
        expect(Number(value('Visited')!.textContent)).toBeGreaterThan(0);
        // path cells include both endpoints; the panel shows steps between them
        expect(value('Path')).toHaveTextContent(String(expectedPathLength() - 1));
        // plain cells cost 1 each, so the cost equals the steps
        expect(value('Cost')).toHaveTextContent(String(expectedPathLength() - 1));
    });

    // Resizing wipes the canvas and the run is re-solved at the new size; the repaint must come
    // after every clear (canvas resize, overlay clear), or the finished path vanishes
    it('keeps a finished path on screen after the grid is resized', async () => {
        const overlay = await renderAndVisualize();

        act(() => useGridStore.getState().resize(useGridStore.getState().cellSize + 1));
        act(() => void raf.flush());

        expect(pathOnScreen(overlay)).toHaveLength(expectedPathLength());
    });

    // The toolbar and the canvas share the one controller the page owns
    describe('controls driving the real controller', () => {
        const button = (name: string) => screen.getByRole('button', { name });

        it('locks the grid while running, then unlocks and re-enables the controls when done', async () => {
            render(<Grid />);
            const user = userEvent.setup();

            await user.click(button('Visualize'));
            expect(button('Visualize')).toBeDisabled();
            expect(button('Pause')).toBeInTheDocument();
            expect(useGridStore.getState().gridLock).toBe(true);

            act(() => void raf.flush());
            expect(button('Visualize')).toBeEnabled();
            expect(button('Step')).toBeInTheDocument();
            expect(useGridStore.getState().gridLock).toBe(false);
        });

        it('pausing a run gives the Step button back and unlocks the grid', async () => {
            render(<Grid />);
            const user = userEvent.setup();

            await user.click(button('Visualize'));
            await user.click(button('Pause'));
            expect(button('Step')).toBeInTheDocument();
            expect(button('Visualize')).toBeEnabled();
            expect(useGridStore.getState().gridLock).toBe(false);
        });

        // picking an algorithm mid-run used to retarget the controls, so Pause reached nothing and the
        // old run kept animating behind a "paused" UI
        it('picking another algorithm mid-run keeps the run pausable', async () => {
            render(<Grid />);
            const overlay = screen
                .getByRole('main')
                .querySelectorAll('canvas')[1]
                .getContext('2d') as unknown as MockCtx;
            const user = userEvent.setup();

            await user.click(button('Visualize'));
            act(() => void raf.frame());
            await user.click(within(button(algoLabels[0]).parentElement!).getByText(algoLabels[1]));
            await user.click(button('Pause'));
            expect(button('Step')).toBeInTheDocument();
            expect(useGridStore.getState().gridLock).toBe(false);

            const fills = overlay.fills.length;
            act(() => void raf.flush());
            expect(overlay.fills).toHaveLength(fills);
        });

        it('picking another algorithm mid-run lets the run finish with the path it was finding', async () => {
            render(<Grid />);
            const overlay = screen
                .getByRole('main')
                .querySelectorAll('canvas')[1]
                .getContext('2d') as unknown as MockCtx;
            const user = userEvent.setup();

            await user.click(button('Visualize'));
            act(() => void raf.frame());
            await user.click(within(button(algoLabels[0]).parentElement!).getByText(algoLabels[1]));
            act(() => void raf.flush());

            expect(button('Visualize')).toBeEnabled();
            expect(useGridStore.getState().gridLock).toBe(false);
            expect(pathOnScreen(overlay)).toHaveLength(expectedPathLength());
        });

        it('generates a maze into the grid', async () => {
            seedRandom(3);
            render(<Grid />);
            const user = userEvent.setup();
            const maze = mazeRegistry[0].label;

            await user.click(within(button('Mazes & Patterns').parentElement!).getByText(maze));
            expect(useGridStore.getState().gridLock).toBe(true);

            act(() => void raf.flush());
            const { cells, gridLock, markersHidden } = useGridStore.getState();
            expect(gridLock).toBe(false);
            expect(cells).toContain(CellKind.wall);
            expect(markersHidden).toBe(false);
        });

        describe('menu actions on the real store', () => {
            const pick = async (label: string) => {
                await userEvent.setup().click(within(button('Mazes & Patterns').parentElement!).getByText(label));
                act(() => void raf.flush());
            };
            const store = () => useGridStore.getState();

            beforeEach(() => {
                render(<Grid />);
                store().setWall(0, 0);
                store().setWeight(0, 1, WEIGHT_LEVELS[2]);
            });

            it('Clear Board empties the board', async () => {
                await pick('Clear Board');
                expect(store().cells).not.toContain(CellKind.wall);
                expect(store().weightAt(0, 1)).toBe(DEFAULT_WEIGHT);
                expect(store().gridLock).toBe(false);
            });

            it('Clear Weights keeps the walls', async () => {
                await pick('Clear Weights');
                expect(store().at(0, 0)).toBe(CellKind.wall);
                expect(store().weightAt(0, 1)).toBe(DEFAULT_WEIGHT);
            });

            it('Random Weights keeps the walls and adds terrain', async () => {
                seedRandom(3);
                await pick('Random Weights');
                expect(store().at(0, 0)).toBe(CellKind.wall);
                expect(store().weights.some((w) => WEIGHT_LEVELS.includes(w))).toBe(true);
                expect(store().markersHidden).toBe(false);
            });
        });
    });
});
