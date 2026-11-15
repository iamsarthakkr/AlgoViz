// Authored by - Sarthak Kumar
//
// overlayPainter: pure draw functions for the overlay canvas layer (algorithm visualization).
// - paintAlgoEvent: paints one AlgoEvent (enqueue/visit) as it's yielded by the runner
// - animateFinalPath: runs its own independent rAF loop to trace the final path cell-by-cell
// - clearOverlay: wipes the overlay canvas (called before/after each run)
// - Nothing redraws the markers here: the overlay multiplies with the base, so they show through

import { AlgoEvent } from '@/types/algo';
import { Coord } from '@/types/grid';
import { lightPalette as palette } from './colors';

export function clearOverlay(ctx: CanvasRenderingContext2D, rows: number, cols: number, s: number) {
    ctx.clearRect(0, 0, cols * s, rows * s);
}

function fillCell(ctx: CanvasRenderingContext2D, r: number, c: number, cellsize: number, color: string) {
    ctx.fillStyle = color;
    const x = c * cellsize,
        y = r * cellsize;
    ctx.fillRect(x, y, cellsize, cellsize);
}

function fillPathCell(ctx: CanvasRenderingContext2D, cell: Coord, cellsize: number) {
    ctx.fillStyle = palette.pathCell;
    const x = cell.c * cellsize,
        y = cell.r * cellsize;
    const offset = 0.25;
    ctx.fillRect(x - offset, y - offset, cellsize + 2 * offset, cellsize + 2 * offset);
}

export function drawFinalPath(
    ctx: CanvasRenderingContext2D,
    nodes: Coord[],
    s: number,
    opts?: { skipEndpoints?: boolean },
) {
    if (!nodes.length) return;
    const startIdx = opts?.skipEndpoints ? 1 : 0;
    const endIdx = opts?.skipEndpoints ? nodes.length - 1 : nodes.length;
    for (let i = startIdx; i < endIdx; i++) {
        fillPathCell(ctx, nodes[i], s);
    }
}

/** animate by filling N cells per frame; returns cancel fn */
export function animateFinalPath(ctx: CanvasRenderingContext2D, nodes: Coord[], s: number, nps = 240) {
    if (!nodes.length) return () => {};
    let i = 0;
    let raf = 0;
    const perFrame = Math.max(1, Math.ceil(nps / 60));

    const step = () => {
        for (let k = 0; k < perFrame && i < nodes.length; k++, i++) {
            fillPathCell(ctx, nodes[i], s);
        }
        if (i < nodes.length) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
}

export function paintAlgoEvent(
    ctx: CanvasRenderingContext2D,
    cellSize: number,
    e: AlgoEvent,
    opts?: {
        drawPathInstant?: boolean;
    },
) {
    switch (e.type) {
        case 'enqueue':
            fillCell(ctx, e.at.r, e.at.c, cellSize, palette.frontier);
            break;
        case 'visit':
            fillCell(ctx, e.at.r, e.at.c, cellSize, palette.visited);
            break;
        case 'path':
            if (opts?.drawPathInstant) drawFinalPath(ctx, e.nodes, cellSize);
            break;
    }
}
