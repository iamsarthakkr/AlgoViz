import { describe, expect, it } from 'vitest';
import { drawBaseScene, drawGoalMarker, drawMarkers, drawStartMarker, lightPalette } from '@/features/painters';
import { weightColor } from '@/features/painters/colors';
import { CellKind } from '@/types/grid';
import { DEFAULT_WEIGHT, MAX_CELL, MIN_CELL, WEIGHT_LEVELS } from '@/utils/constants';
import { createMockCtx, MockCtx } from '../../helpers/canvas';

const S = 10;
const HIDDEN = { r: -1, c: -1 };

// a scene with no markers unless given: markers draw arcs/strokes that would muddy the cell checks
function scene(overrides: Partial<Parameters<typeof drawBaseScene>[0]> & { cells: CellKind[]; cols: number }) {
    const ctx = createMockCtx();
    const rows = overrides.cells.length / overrides.cols;
    drawBaseScene({
        ctx,
        rows,
        cellSize: S,
        weights: Array(overrides.cells.length).fill(DEFAULT_WEIGHT),
        start: HIDDEN,
        goal: HIDDEN,
        markersHidden: true,
        ...overrides,
    });
    return ctx;
}
// the fill colour of each cell, in row-major order (the first fill is the background)
const cellFills = (ctx: MockCtx, count: number) => ctx.fills.slice(1, 1 + count).map((f) => f.style);

describe('basePainter', () => {
    it('drawBaseScene paints background, then one fill per cell in its colour', () => {
        const cells = [CellKind.empty, CellKind.wall, CellKind.wall, CellKind.empty];
        const ctx = scene({
            cells,
            cols: 2,
            start: { r: 0, c: 0 },
            goal: { r: 1, c: 1 },
            markersHidden: false,
        });

        expect(ctx.fills[0]).toMatchObject({ style: lightPalette.background, x: 0, y: 0, w: 2 * S, h: 2 * S });
        expect(cellFills(ctx, cells.length)).toEqual([
            lightPalette.cellEmpty,
            lightPalette.cellWall,
            lightPalette.cellWall,
            lightPalette.cellEmpty,
        ]);
        expect(ctx.strokeRect).toHaveBeenCalledWith(0, 0, 2 * S, 2 * S);
    });

    // Lines between two walls are skipped so adjacent walls read as one solid block
    it('skips grid lines between two walls', () => {
        const open = scene({ cells: [CellKind.empty, CellKind.empty], cols: 2 });
        const walled = scene({ cells: [CellKind.wall, CellKind.wall], cols: 2 });
        expect(open.moveTo).toHaveBeenCalledWith(S, 0);
        expect(walled.moveTo).not.toHaveBeenCalledWith(S, 0);
    });

    describe('weighted cells', () => {
        const row = (n: number) => Array(n).fill(CellKind.empty);

        it('fills each weight level with its palette colour, and default-weight cells as empty', () => {
            const weights = [DEFAULT_WEIGHT, ...WEIGHT_LEVELS];
            const ctx = scene({ cells: row(weights.length), cols: weights.length, weights });
            expect(cellFills(ctx, weights.length)).toEqual([lightPalette.cellEmpty, ...lightPalette.weights]);
        });

        it('weightColor maps each level to its palette colour', () => {
            WEIGHT_LEVELS.forEach((w, i) => expect(weightColor(w, lightPalette)).toBe(lightPalette.weights[i]));
            expect(weightColor(DEFAULT_WEIGHT, lightPalette)).toBe(lightPalette.cellEmpty);
        });

        // the palette has one colour per level; a mismatch would paint a level as undefined
        it('the palette has exactly one colour per weight level', () => {
            expect(lightPalette.weights).toHaveLength(WEIGHT_LEVELS.length);
        });

        // A marker's cell weight never counts (the snapshot treats it as plain), so the grid must not
        // show a weight there either
        it('draws a marker cell as plain even when a weight is stored under it', () => {
            const heavy = WEIGHT_LEVELS[WEIGHT_LEVELS.length - 1];
            const ctx = scene({
                cells: row(3),
                cols: 3,
                weights: [heavy, heavy, heavy],
                start: { r: 0, c: 0 },
                goal: { r: 0, c: 2 },
                markersHidden: false,
            });
            expect(cellFills(ctx, 3)).toEqual([
                lightPalette.cellEmpty,
                lightPalette.weights.at(-1),
                lightPalette.cellEmpty,
            ]);
        });

        // Colour alone isn't enough for colour-blind users: large cells also show 1-3 dots for the level.
        // (Dots are drawn as arcs; no markers here, so every arc is a dot.)
        it.each(WEIGHT_LEVELS.map((w, i) => [w, i + 1]))(
            'weight %i is marked with %i dot(s) on large cells',
            (w, dots) => {
                const ctx = createMockCtx();
                drawBaseScene({
                    ctx,
                    rows: 1,
                    cols: 1,
                    cellSize: MAX_CELL,
                    cells: row(1),
                    weights: [w],
                    start: HIDDEN,
                    goal: HIDDEN,
                    markersHidden: true,
                });
                expect(ctx.arc).toHaveBeenCalledTimes(dots);
            },
        );

        it('draws no dots on small cells, where they would be noise', () => {
            const ctx = createMockCtx();
            drawBaseScene({
                ctx,
                rows: 1,
                cols: 1,
                cellSize: MIN_CELL,
                cells: row(1),
                weights: [WEIGHT_LEVELS[WEIGHT_LEVELS.length - 1]],
                start: HIDDEN,
                goal: HIDDEN,
                markersHidden: true,
            });
            expect(ctx.arc).not.toHaveBeenCalled();
        });
    });

    it('drawMarkers draws both markers', () => {
        const ctx = createMockCtx();
        drawMarkers(ctx, { r: 0, c: 0 }, { r: 1, c: 1 }, S);
        expect(ctx.strokeStyles).toEqual([lightPalette.start, lightPalette.goal]);
    });

    it('drawBaseScene leaves the markers out while they are hidden', () => {
        const ctx = scene({
            cells: [CellKind.empty, CellKind.empty],
            cols: 2,
            start: { r: 0, c: 0 },
            goal: { r: 0, c: 1 },
        });
        expect(ctx.strokeStyles).not.toContain(lightPalette.start);
        expect(ctx.strokeStyles).not.toContain(lightPalette.goal);
    });

    it('drawStartMarker strokes an arrow centred in the cell', () => {
        const ctx = createMockCtx();
        drawStartMarker(ctx, { r: 2, c: 3 }, S);
        expect(ctx.strokeStyles).toEqual([lightPalette.start]);
        // centre of (2,3) is (35, 25); the arrow tip sits on the centre line
        expect(ctx.lineTo).toHaveBeenCalledWith(expect.any(Number), 25);
    });

    it('drawGoalMarker draws a filled dot inside a ring', () => {
        const ctx = createMockCtx();
        drawGoalMarker(ctx, { r: 0, c: 0 }, S);
        expect(ctx.arc).toHaveBeenCalledTimes(2);
        expect(ctx.fill).toHaveBeenCalledTimes(1);
        expect(ctx.strokeStyles).toEqual([lightPalette.goal]);
    });
});
