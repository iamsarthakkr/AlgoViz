import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Legend } from '@/ui/Legend';
import { lightPalette as palette } from '@/features/painters';
import { DrawTool } from '@/types/grid';
import { WEIGHT_LEVEL_NAMES, WEIGHT_LEVELS } from '@/utils/constants';
import { MockCtx } from '../helpers/canvas';

const KEY_LABELS = ['Start', 'Goal', 'Frontier', 'Visited', 'Path'];
const WALL = 'Draw walls';
const WEIGHT_NAMES = WEIGHT_LEVELS.map((w, i) => `Draw ${WEIGHT_LEVEL_NAMES[i].toLowerCase()} weight, cost ${w}`);
const DRAW_NAMES = [WALL, ...WEIGHT_NAMES];

// the swatch canvas of a key item (by its text) or a draw button (by its accessible name)
const keySwatch = (label: string) => screen.getByText(label).closest('li')!.querySelector('canvas')!;
const drawButton = (name: string) => screen.getByRole('button', { name });
const drawSwatch = (name: string) => drawButton(name).querySelector('canvas')!;
const ctxOf = (canvas: HTMLCanvasElement) => canvas.getContext('2d') as unknown as MockCtx;
const allSwatches = () => [...KEY_LABELS.map(keySwatch), ...DRAW_NAMES.map(drawSwatch)];
const pressed = () => screen.getAllByRole('button', { pressed: true });

const WALL_TOOL: DrawTool = { type: 'wall' };
const weightTool = (level: number): DrawTool => ({ type: 'weight', weight: WEIGHT_LEVELS[level] });

// the legend is controlled: the page passes the store's tool and setTool
const renderLegend = (props: Partial<Parameters<typeof Legend>[0]> = {}) => {
    const onSelectTool = vi.fn();
    const utils = render(<Legend tool={WALL_TOOL} onSelectTool={onSelectTool} {...props} />);
    return { onSelectTool, ...utils };
};

describe('Legend', () => {
    it('is a labelled side region the page can place', () => {
        renderLegend({ className: '[grid-area:legend]' });
        const region = screen.getByRole('complementary', { name: 'Legend' });
        expect(region).toHaveClass('[grid-area:legend]');
        expect(region).toHaveTextContent('Legend');
    });

    describe('key', () => {
        it('lists every grid colour, each with a swatch', () => {
            renderLegend();
            expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(KEY_LABELS);
            KEY_LABELS.forEach((label) => expect(keySwatch(label)).toBeInTheDocument());
        });

        // only the palette is clickable; the key is information
        it('has no buttons', () => {
            renderLegend();
            for (const li of screen.getAllByRole('listitem')) expect(within(li).queryByRole('button')).toBeNull();
        });
    });

    describe('draw palette', () => {
        it('offers Wall and every weight level, in order, as named toggle buttons', () => {
            renderLegend();
            const group = screen.getByRole('group', { name: 'Draw tool' });
            expect(
                within(group)
                    .getAllByRole('button')
                    .map((b) => b.getAttribute('aria-label')),
            ).toEqual(DRAW_NAMES);
            for (const name of DRAW_NAMES) expect(drawButton(name)).toHaveAttribute('aria-pressed');
        });

        it('shows exactly the given tool as pressed', () => {
            renderLegend();
            expect(pressed()).toEqual([drawButton(WALL)]);
        });

        it.each(WEIGHT_NAMES.map((name, level) => [name, level]))(
            'shows %s as pressed when it is the tool',
            (name, level) => {
                renderLegend({ tool: weightTool(level) });
                expect(pressed()).toEqual([drawButton(name)]);
            },
        );

        // the legend doesn't own the selection: a click reports the tool, the page decides
        it('reports the clicked tool and leaves the selection to the page', async () => {
            const { onSelectTool } = renderLegend();
            await userEvent.click(drawButton(WEIGHT_NAMES[1]));
            expect(onSelectTool).toHaveBeenCalledWith(weightTool(1));
            expect(pressed()).toEqual([drawButton(WALL)]);
        });

        // On phones the legend is an `auto` grid row: if selecting changed what renders, the row's
        // height could change and resize the grid. Selection must only change styles.
        it('renders the same elements whichever tool is selected', () => {
            const { container, rerender } = renderLegend();
            const shape = () => [...container.querySelectorAll('*')].map((el) => el.tagName).join();
            const before = shape();
            for (const tool of [WALL_TOOL, ...WEIGHT_LEVELS.map((_, level) => weightTool(level))]) {
                rerender(<Legend tool={tool} onSelectTool={vi.fn()} />);
                expect(shape()).toBe(before);
            }
        });
    });

    // the meaning is in the label or the button's name; the swatch is decoration
    it('hides the swatches from screen readers', () => {
        renderLegend();
        allSwatches().forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
    });

    it('borders each swatch with the grid line colour', () => {
        renderLegend();
        allSwatches().forEach((s) => expect(s).toHaveStyle({ borderColor: palette.gridLine }));
    });

    // Swatches are drawn with the grid's palette and painters, so they can't drift from what the grid shows
    describe('swatches match the grid', () => {
        // the swatch shows a colour as it looks on a plain cell
        it('every swatch starts with a full empty-cell background', () => {
            renderLegend();
            allSwatches().forEach((s) => {
                const size = parseFloat(s.style.width);
                expect(ctxOf(s).fills[0]).toEqual({ style: palette.cellEmpty, x: 0, y: 0, w: size, h: size });
            });
        });

        it('Wall fills the whole swatch with the wall colour', () => {
            renderLegend();
            const s = drawSwatch(WALL);
            const size = parseFloat(s.style.width);
            expect(ctxOf(s).fills.slice(1)).toEqual([{ style: palette.cellWall, x: 0, y: 0, w: size, h: size }]);
        });

        // the same tint and the same number of dots the grid draws for that level
        it.each(WEIGHT_NAMES.map((name, i) => [name, i]))('"%s" shows its level tint and %i+1 dots', (name, level) => {
            renderLegend();
            const ctx = ctxOf(drawSwatch(name));
            expect(ctx.fills[1].style).toBe(palette.weights[level]);
            expect(ctx.arc).toHaveBeenCalledTimes(level + 1);
        });

        it.each([
            ['Frontier', palette.frontier],
            ['Visited', palette.visited],
            ['Path', palette.pathCell],
        ])('%s then fills the whole swatch with its palette colour', (label, colour) => {
            renderLegend();
            const s = keySwatch(label);
            const size = parseFloat(s.style.width);
            expect(ctxOf(s).fills.slice(1)).toEqual([{ style: colour, x: 0, y: 0, w: size, h: size }]);
        });

        it.each([
            ['Start', palette.start],
            ['Goal', palette.goal],
        ])('%s is drawn with its marker painter', (label, colour) => {
            renderLegend();
            expect(ctxOf(keySwatch(label)).strokeStyles).toEqual([colour]);
        });
    });

    // the page re-renders every animation frame during a run; swatches must not redraw each time
    it('does not redraw the swatches when it re-renders', () => {
        const { rerender } = renderLegend();
        const ctx = ctxOf(drawSwatch(WEIGHT_NAMES[0]));
        const fills = ctx.fills.length;
        const clears = vi.mocked(ctx.clearRect).mock.calls.length;

        rerender(<Legend tool={WALL_TOOL} onSelectTool={vi.fn()} />);
        rerender(<Legend tool={WALL_TOOL} onSelectTool={vi.fn()} />);
        expect(ctx.fills).toHaveLength(fills);
        expect(ctx.clearRect).toHaveBeenCalledTimes(clears);
    });
});
