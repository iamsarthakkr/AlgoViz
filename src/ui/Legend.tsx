// Authored by - Sarthak Kumar
//
// Legend: the draw palette (Wall and the weight levels, selectable) and the key to what each colour
// on the grid means. Swatches are drawn with the grid's own painters and palette, so they can't drift.
// - Draw items are toggle buttons (aria-pressed); the key items are plain text
// - Selection is shown with a ring (a box-shadow), never a border or size change: on phones this panel
//   is an `auto` grid row, and a size change would resize the grid and stop a run
// - Controlled: the page passes the settings store's tool and setTool, so the legend stays pure

import React from 'react';
import { useCanvasLayer } from '@/components/useCanvasLayer';
import {
    drawGoalMarker,
    drawStartMarker,
    drawWeightDots,
    lightPalette as palette,
    weightColor,
} from '@/features/painters';
import { DrawTool } from '@/types/grid';
import { WEIGHT_LEVEL_NAMES, WEIGHT_LEVELS } from '@/utils/constants';

const SIZE = 24;
const at = { r: 0, c: 0 };
const fill = (color: string) => (ctx: CanvasRenderingContext2D, s: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, s, s);
};

type Draw = (ctx: CanvasRenderingContext2D, size: number) => void;

type DrawItem = {
    tool: DrawTool;
    label: string; // short form, for phones
    longLabel: string;
    name: string; // accessible name
    draw: Draw;
};

// module level, so every `draw` is a stable function and swatches don't redraw on re-renders
const DRAW_ITEMS: DrawItem[] = [
    { tool: { type: 'wall' }, label: 'Wall', longLabel: 'Wall', name: 'Draw walls', draw: fill(palette.cellWall) },
    ...WEIGHT_LEVELS.map((weight, level): DrawItem => ({
        tool: { type: 'weight', weight },
        label: `×${weight}`,
        longLabel: `${WEIGHT_LEVEL_NAMES[level]} ×${weight}`,
        name: `Draw ${WEIGHT_LEVEL_NAMES[level].toLowerCase()} weight, cost ${weight}`,
        draw: (ctx, s) => {
            fill(weightColor(weight, palette))(ctx, s);
            drawWeightDots(ctx, at, s, level + 1);
        },
    })),
];

const KEY_ITEMS: { label: string; draw: Draw }[] = [
    { label: 'Start', draw: (ctx, s) => drawStartMarker(ctx, at, s) },
    { label: 'Goal', draw: (ctx, s) => drawGoalMarker(ctx, at, s) },
    { label: 'Frontier', draw: fill(palette.frontier) },
    { label: 'Visited', draw: fill(palette.visited) },
    { label: 'Path', draw: fill(palette.pathCell) },
];

const sameTool = (a: DrawTool, b: DrawTool) =>
    a.type === b.type && (a.type === 'wall' || (b.type === 'weight' && a.weight === b.weight));

const LegendItem = ({ draw }: { draw: Draw }) => {
    const { ref, getCtx } = useCanvasLayer(1, 1, SIZE);

    React.useEffect(() => {
        const ctx = getCtx();
        if (!ctx) return;

        fill(palette.cellEmpty)(ctx, SIZE);
        draw(ctx, SIZE);
        return () => ctx.clearRect(0, 0, SIZE, SIZE);
    }, [getCtx, draw]);

    return (
        <canvas ref={ref} aria-hidden="true" className="shrink-0 border" style={{ borderColor: palette.gridLine }} />
    );
};

type Props = {
    className?: string;
    tool: DrawTool;
    onSelectTool: (tool: DrawTool) => void;
};

export const Legend = ({ className = '', tool, onSelectTool }: Props) => {
    return (
        <aside
            aria-label="Legend"
            className={`${className} text-sm xl:text-base flex flex-col items-center justify-center gap-2 xl:gap-6`}
        >
            <section className="w-full">
                <h2 className="hidden xl:block xl:text-lg font-semibold mb-2">Draw</h2>
                <div
                    role="group"
                    aria-label="Draw tool"
                    className="flex flex-wrap justify-center gap-1.5 xl:flex-col xl:gap-1"
                >
                    {DRAW_ITEMS.map((item) => {
                        const pressed = sameTool(item.tool, tool);
                        return (
                            <button
                                key={item.name}
                                type="button"
                                aria-label={item.name}
                                aria-pressed={pressed}
                                onClick={() => onSelectTool(item.tool)}
                                className={`flex items-center gap-1.5 min-h-11 px-1.5 rounded-md xl:min-h-0 xl:px-2 xl:py-1.5 xl:gap-2 outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                                    pressed ? 'ring-2 ring-primary bg-primary/10 font-semibold' : 'hover:bg-primary/5'
                                }`}
                            >
                                <LegendItem draw={item.draw} />
                                <span className="xl:hidden">{item.label}</span>
                                <span className="hidden xl:inline">{item.longLabel}</span>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="w-full">
                <h2 className="hidden xl:block xl:text-lg font-semibold mb-2">Legend</h2>
                <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 xl:flex-col xl:gap-2">
                    {KEY_ITEMS.map(({ label, draw }) => (
                        <li key={label} className="flex items-center gap-2">
                            <LegendItem draw={draw} />
                            <span>{label}</span>
                        </li>
                    ))}
                </ul>
            </section>
        </aside>
    );
};
