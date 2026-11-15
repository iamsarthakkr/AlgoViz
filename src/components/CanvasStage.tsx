// Authored by - Sarthak Kumar
//
// CanvasStage: stacks two <canvas> layers for the grid.
// - base layer: cells/walls/markers, redrawn on grid state changes
// - overlay layer (pointer-events: none): frontier/visited/path painted by the runner. It blends with
//   the base (mix-blend-mode: multiply) instead of covering it, so weights, grid lines and markers
//   stay visible through a run. Must be CSS: canvas compositing can't blend across two canvases
// - exposes both 2D contexts via useImperativeHandle for imperative drawing

import React, { forwardRef, useImperativeHandle } from 'react';
import { useCanvasLayer } from './useCanvasLayer';

export type CanvasStageHandle = {
    /** 2D contexts for drawing */
    getBaseCtx(): CanvasRenderingContext2D | null;
    getOverlayCtx(): CanvasRenderingContext2D | null;
};

type Props = {
    rows: number;
    cols: number;
    cellSize: number;
    className?: string;
    style?: React.CSSProperties;
};

export const CanvasStage = forwardRef<CanvasStageHandle, Props>(function CanvasStage(
    { rows, cols, cellSize, className, style },
    ref,
) {
    const base = useCanvasLayer(rows, cols, cellSize);
    const overlay = useCanvasLayer(rows, cols, cellSize);

    useImperativeHandle(
        ref,
        () => ({
            getBaseCtx: base.getCtx,
            getOverlayCtx: overlay.getCtx,
        }),
        [base.getCtx, overlay.getCtx],
    );

    const w = cols * cellSize,
        h = rows * cellSize;

    return (
        <div style={{ ...style, position: 'relative', width: w, height: h }} className={className}>
            <canvas ref={base.ref} style={{ position: 'absolute', inset: 0 }} />
            <canvas
                ref={overlay.ref}
                style={{ position: 'absolute', inset: 0, pointerEvents: 'none', mixBlendMode: 'multiply' }}
            />
        </div>
    );
});
