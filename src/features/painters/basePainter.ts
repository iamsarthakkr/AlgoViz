// Authored by - Sarthak Kumar
//
// basePainter: pure draw functions for the base canvas layer (cells, walls, weights, grid lines, markers).
// - drawBaseScene is the main entry point, called on every grid state change
// - Weighted cells get their level's tint plus 1-3 dots, so the level doesn't rely on colour alone
//   (colour-blind users); dots are skipped below WEIGHT_DOTS_MIN_CELL, where they'd be noise
// - Marker cells are drawn plain even with a weight stored under them: it never counts, so it isn't shown
// - drawGridLines skips segments between two adjacent walls so wall blocks render as solid shapes
// - drawStartMarker/drawGoalMarker draw the arrow/ringed-dot glyphs

import { CellKind, Coord } from '@/types/grid';
import { lightPalette as palette, weightColor, weightLevel } from './colors';

const WEIGHT_DOTS_MIN_CELL = 16;

function center(p: Coord, s: number) {
    return [p.c * s + s / 2, p.r * s + s / 2] as const;
}

export function drawStartMarker(ctx: CanvasRenderingContext2D, p: Coord, s: number) {
    const size = Math.max(6, s * 0.5); // scale with cell size

    const [cx, cy] = center(p, s);
    ctx.strokeStyle = palette.start;
    ctx.lineWidth = Math.max(2, s * 0.15);
    ctx.lineCap = 'round';

    ctx.beginPath();
    // upper line
    ctx.moveTo(cx - size * 0.4, cy - size * 0.4);
    ctx.lineTo(cx + size * 0.4, cy);
    // lower line
    ctx.lineTo(cx - size * 0.4, cy + size * 0.4);
    ctx.stroke();
}

export function drawGoalMarker(ctx: CanvasRenderingContext2D, p: Coord, s: number) {
    const [cx, cy] = center(p, s);
    const radius = Math.max(5, s * 0.35);

    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = palette.goal;
    ctx.lineWidth = Math.max(2, radius * 0.25);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
}

export function drawMarkers(ctx: CanvasRenderingContext2D, start: Coord, goal: Coord, cellSize: number) {
    drawStartMarker(ctx, start, cellSize);
    drawGoalMarker(ctx, goal, cellSize);
}

function drawGridLines(
    ctx: CanvasRenderingContext2D,
    rows: number,
    cols: number,
    cellSize: number,
    cells: CellKind[],
    color: string,
) {
    const id = (r: number, c: number) => r * cols + c;

    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;

    // Horizontal grid segments
    for (let r = 1; r < rows; r++) {
        const y = r * cellSize;
        for (let c = 0; c < cols; c++) {
            const above = cells[id(r - 1, c)];
            const below = cells[id(r, c)];

            if (above === CellKind.wall && below === CellKind.wall) continue;

            ctx.beginPath();
            ctx.moveTo(c * cellSize, y);
            ctx.lineTo((c + 1) * cellSize, y);
            ctx.stroke();
        }
    }

    for (let c = 1; c < cols; c++) {
        const x = c * cellSize;
        for (let r = 0; r < rows; r++) {
            const left = cells[id(r, c - 1)];
            const right = cells[id(r, c)];

            if (left === CellKind.wall && right === CellKind.wall) continue;

            ctx.beginPath();
            ctx.moveTo(x, r * cellSize);
            ctx.lineTo(x, (r + 1) * cellSize);
            ctx.stroke();
        }
    }
}

type Scene = {
    ctx: CanvasRenderingContext2D;
    rows: number;
    cols: number;
    cellSize: number;
    cells: CellKind[];
    weights: number[];
    start: Coord;
    goal: Coord;
    markersHidden: boolean;
};

// exported for the legend's weight swatches, so they match the grid
export function drawWeightDots(ctx: CanvasRenderingContext2D, p: Coord, cellSize: number, count: number) {
    const radius = Math.max(1.5, cellSize * 0.07);
    const gap = radius * 3;
    const [cx, cy] = center(p, cellSize);
    const firstX = cx - ((count - 1) * gap) / 2;

    ctx.fillStyle = palette.weightMark;
    for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.arc(firstX + i * gap, cy, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// draws base grid with grid lines, cells and markers
export function drawBaseScene(scene: Scene) {
    const { ctx, rows, cols, cellSize, cells, weights, start, goal, markersHidden } = scene;
    // background
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, cols * cellSize, rows * cellSize);

    // cells
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const isEndpoint = (r === start.r && c === start.c) || (r === goal.r && c === goal.c);
            const id = r * cols + c;
            const kind = cells[id];
            const w = weights[id];

            ctx.fillStyle =
                kind === CellKind.wall ? palette.cellWall : isEndpoint ? palette.cellEmpty : weightColor(w, palette);
            const x = c * cellSize;
            const y = r * cellSize;

            const offset = 0.25;
            ctx.fillRect(x - offset, y - offset, cellSize + 2 * offset, cellSize + 2 * offset);
        }
    }

    // grid lines
    drawGridLines(ctx, rows, cols, cellSize, cells, palette.gridLine);

    // weight level dots
    if (cellSize >= WEIGHT_DOTS_MIN_CELL) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const id = r * cols + c;
                const isEndpoint = (r === start.r && c === start.c) || (r === goal.r && c === goal.c);
                const level = weightLevel(weights[id]);
                if (cells[id] === CellKind.wall || isEndpoint || level < 0) continue;
                drawWeightDots(ctx, { r, c }, cellSize, level + 1);
            }
        }
    }

    // outer border
    ctx.strokeStyle = palette.gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, cols * cellSize, rows * cellSize);

    // markers
    if (!markersHidden) drawMarkers(ctx, start, goal, cellSize);
}
