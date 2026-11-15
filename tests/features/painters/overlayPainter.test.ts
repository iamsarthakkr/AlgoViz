import { beforeEach, describe, expect, it } from 'vitest';
import { animateFinalPath, clearOverlay, lightPalette, paintAlgoEvent } from '@/features/painters';
import { drawFinalPath } from '@/features/painters/overlayPainter';
import { createMockCtx } from '../../helpers/canvas';
import { installFakeRaf } from '../../helpers/raf';

const S = 10;
const path = [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 0, c: 2 },
    { r: 1, c: 2 },
];

describe('overlayPainter', () => {
    let raf: ReturnType<typeof installFakeRaf>;
    beforeEach(() => {
        raf = installFakeRaf();
    });

    it('clearOverlay clears the whole grid area', () => {
        const ctx = createMockCtx();
        clearOverlay(ctx, 3, 4, S);
        expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 40, 30);
    });

    it('paints enqueue and visit events in their palette colours', () => {
        const ctx = createMockCtx();
        paintAlgoEvent(ctx, S, { type: 'enqueue', at: { r: 1, c: 2 } });
        paintAlgoEvent(ctx, S, { type: 'visit', at: { r: 1, c: 2 } });
        expect(ctx.fills).toEqual([
            { style: lightPalette.frontier, x: 20, y: 10, w: S, h: S },
            { style: lightPalette.visited, x: 20, y: 10, w: S, h: S },
        ]);
    });

    it('draws the path instantly only when asked to', () => {
        const animated = createMockCtx();
        paintAlgoEvent(animated, S, { type: 'path', nodes: path, visited: 4, cost: 3 });
        expect(animated.fills).toHaveLength(0);

        const instant = createMockCtx();
        paintAlgoEvent(instant, S, { type: 'path', nodes: path, visited: 4, cost: 3 }, { drawPathInstant: true });
        expect(instant.fills.map((f) => f.style)).toEqual(Array(4).fill(lightPalette.pathCell));
    });

    // the overlay multiplies with the base canvas, where the markers already are
    it('leaves the markers to the base layer', () => {
        const ctx = createMockCtx();
        paintAlgoEvent(ctx, S, { type: 'visit', at: { r: 0, c: 1 } });
        expect(ctx.stroke).not.toHaveBeenCalled();
        expect(ctx.arc).not.toHaveBeenCalled();
    });

    // Opaque, because the canvas blends with the base. A translucent colour would darken each time a cell
    // is repainted, and frontier + visited would stack.
    it.each(['frontier', 'visited', 'pathCell'] as const)('%s is an opaque colour', (name) => {
        expect(lightPalette[name]).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('drawFinalPath can skip the endpoints', () => {
        const ctx = createMockCtx();
        drawFinalPath(ctx, path, S, { skipEndpoints: true });
        expect(ctx.fills).toHaveLength(2);
        drawFinalPath(ctx, [], S);
        expect(ctx.fills).toHaveLength(2);
    });

    it('animateFinalPath fills ceil(nps / 60) cells per frame', () => {
        const ctx = createMockCtx();
        animateFinalPath(ctx, path, S, 120); // 2 per frame
        expect(ctx.fills).toHaveLength(0);
        raf.frame();
        expect(ctx.fills).toHaveLength(2);
        raf.flush();
        expect(ctx.fills).toHaveLength(4);
    });

    it('animateFinalPath returns a cancel function that stops the trace', () => {
        const ctx = createMockCtx();
        const cancel = animateFinalPath(ctx, path, S, 60);
        raf.frame();
        cancel();
        raf.flush();
        expect(ctx.fills).toHaveLength(1);
    });

    it('animateFinalPath with no nodes schedules nothing', () => {
        const cancel = animateFinalPath(createMockCtx(), [], S);
        expect(raf.pending()).toBe(0);
        expect(cancel).not.toThrow();
    });
});
