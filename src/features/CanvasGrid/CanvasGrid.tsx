// Authored by - Sarthak Kumar
//
// CanvasGrid: the interactive grid surface — owns pointer input and base-layer redraws.
// - Pointer handlers paint with the settings store's tool (walls or a weight level) and drag the
//   start/goal markers. A drag erases the tool's layer if it starts on a matching cell (a wall, or the
//   same weight level; so touch can erase) or uses right-click/Alt; that choice is fixed for the drag
// - refresh() (gridVersion bump) only when a paint or marker move actually changed the grid:
//   pointermove fires many times per cell, and each bump re-solves a finished run
// - Redraws the base canvas via drawBaseScene whenever grid state changes (debounced via useRaf)
// - Exposes CanvasGridHandle (ctx getters, clearOverlay, redrawBase) for the toolbar/animation hooks
// - Respects gridLock: pointer editing is a no-op while an algorithm/maze run owns the grid

import React, { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useShallow } from 'zustand/shallow';
import { CellKind, DragMode } from '@/types/grid';
import { useGridStore, useSettingsStore } from '@/features/store';
import { CanvasStage, CanvasStageHandle } from '@/components/CanvasStage';
import { clearOverlay, drawBaseScene } from '@/features/painters';
import { useRaf } from '@/features/hooks/useRaf';

/** The API CanvasGrid will expose to parents */
export type CanvasGridHandle = {
    getBaseCtx(): CanvasRenderingContext2D | null;
    getOverlayCtx(): CanvasRenderingContext2D | null;
    clearOverlay(): void;
    redrawBase(): void;
};

type CanvasGridProps = {
    /** disable user edits while an algo runs, if you want */
    style?: React.CSSProperties;
    className?: string;
};

export const CanvasGrid = forwardRef<CanvasGridHandle, CanvasGridProps>(function CanvasGrid(
    { style, className }: CanvasGridProps,
    ref,
) {
    const [rows, cols, cellSize, cells, weights, start, goal, markersHidden] = useGridStore(
        useShallow((s) => [s.rows, s.cols, s.cellSize, s.cells, s.weights, s.start, s.goal, s.markersHidden] as const),
    );

    const stageRef = useRef<CanvasStageHandle>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const dragModeRef = useRef<DragMode>(DragMode.None);

    const schedule = useRaf();

    // ----- expose API to parent -----
    useImperativeHandle(
        ref,
        () => ({
            getBaseCtx: () => stageRef.current?.getBaseCtx() ?? null,
            getOverlayCtx: () => stageRef.current?.getOverlayCtx() ?? null,
            clearOverlay: () => {
                const ctx = stageRef.current?.getOverlayCtx();
                if (ctx) clearOverlay(ctx, rows, cols, cellSize);
            },
            redrawBase: () => {
                const ctx = stageRef.current?.getBaseCtx();
                if (ctx)
                    drawBaseScene({
                        ctx,
                        rows,
                        cols,
                        cellSize,
                        cells,
                        weights,
                        start,
                        goal,
                        markersHidden,
                    });
            },
        }),
        [rows, cols, cellSize, cells, weights, start, goal, markersHidden],
    );

    // animation frames schedule
    useEffect(() => {
        const ctx = stageRef.current?.getBaseCtx();
        if (!ctx) return;
        schedule(() => {
            drawBaseScene({
                ctx,
                rows,
                cols,
                cellSize,
                cells,
                weights,
                start,
                goal,
                markersHidden,
            });
        });
    }, [rows, cols, cellSize, cells, weights, start, goal, markersHidden, schedule]);

    // hit testing
    const hitCell = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const rect = wrapperRef.current!.getBoundingClientRect();
            const r = Math.floor((e.clientY - rect.top) / cellSize);
            const c = Math.floor((e.clientX - rect.left) / cellSize);
            return { r, c };
        },
        [cellSize],
    );

    const paintAt = useCallback((r: number, c: number): boolean => {
        const api = useGridStore.getState();
        const settings = useSettingsStore.getState();
        if (r < 0 || c < 0 || r >= api.rows || c >= api.cols) return false;

        const id = api.idx(r, c);
        const sId = api.idx(api.start.r, api.start.c);
        const gId = api.idx(api.goal.r, api.goal.c);
        if (id === sId || id === gId) return false;

        const { tool } = settings;

        switch (tool.type) {
            case 'wall': {
                const want: CellKind = dragModeRef.current === DragMode.Paint ? CellKind.wall : CellKind.empty;
                if (want === CellKind.wall) {
                    return api.setWall(r, c);
                } else {
                    return api.clearWall(r, c);
                }
            }
            case 'weight': {
                if (dragModeRef.current === DragMode.Paint) {
                    return api.setWeight(r, c, tool.weight);
                } else {
                    return api.clearWeight(r, c);
                }
            }
        }
    }, []);

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const api = useGridStore.getState();
            const settings = useSettingsStore.getState();
            if (api.gridLock) return;

            e.preventDefault();
            const cv = e.currentTarget;
            try {
                cv.setPointerCapture(e.pointerId);
            } catch {
                // no-op
                console.error('failed to capture: ' + e);
            }

            const { r, c } = hitCell(e);

            if (r === api.start.r && c === api.start.c) {
                dragModeRef.current = DragMode.MoveStart;
            } else if (r === api.goal.r && c === api.goal.c) {
                dragModeRef.current = DragMode.MoveGoal;
            } else {
                const { tool } = settings;
                const cellAt = api.at(r, c);
                const weightAt = api.weightAt(r, c);
                const toErase =
                    e.button === 2 ||
                    e.altKey ||
                    (api.inBounds(r, c) && cellAt === CellKind.wall && tool.type === 'wall') ||
                    (api.inBounds(r, c) && tool.type === 'weight' && tool.weight === weightAt);
                dragModeRef.current = toErase ? DragMode.Erase : DragMode.Paint;
                if (paintAt(r, c)) api.refresh();
            }
        },
        [hitCell, paintAt],
    );

    const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            console.error('failed to release capture: ' + e);
        }
        dragModeRef.current = DragMode.None;
    }, []);

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (useGridStore.getState().gridLock) return;
            if (dragModeRef.current === DragMode.None) return;

            const api = useGridStore.getState();
            const { r, c } = hitCell(e);
            let changed = false;

            if (dragModeRef.current === DragMode.MoveStart) changed = api.setStart(r, c);
            else if (dragModeRef.current === DragMode.MoveGoal) changed = api.setGoal(r, c);
            else changed = paintAt(r, c);

            if (changed) api.refresh();
        },
        [hitCell, paintAt],
    );

    const width = cols * cellSize;
    const height = rows * cellSize;

    return (
        <div
            ref={wrapperRef}
            className={className}
            onContextMenu={(e) => e.preventDefault()}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
                position: 'relative',
                width,
                height,
                background: '#fff',
                touchAction: 'none',
                ...style,
            }}
        >
            <CanvasStage ref={stageRef} rows={rows} cols={cols} cellSize={cellSize} />
        </div>
    );
});
