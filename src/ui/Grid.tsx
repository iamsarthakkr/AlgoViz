// Authored by - Sarthak Kumar
//
// Grid: top-level page composition (the whole app is this one view).
// - Owns the single algorithm controller and maze generator, and passes them down as props:
//   every control that drives a run must share one instance (two hook calls = two runners)
// - Owns the info dialog's open state (useInfoModal): the toolbar's button opens it, InfoModal
//   shows it. The dialog has no grid area; as a modal it sits in the browser's top layer
// - The CanvasGrid ref goes only to the controller (which paints the overlay) and CanvasGrid;
//   the controls never touch the canvas directly
// - Layout is the .page grid in index.css: each piece is rendered once and placed by its named
//   grid area (header, grid, stats, legend, controls); only the area map changes per breakpoint
// - The grid's box is the `grid` area inside a padded <main>; the box itself has no padding,
//   because useResponsiveGrid measures it and load/resize must see the same size

import { useRef } from 'react';
import { CanvasGrid, CanvasGridHandle } from '@/features/CanvasGrid';
import { PlaybackControls, Toolbar } from '@/features/Toolbar';
import { useResponsiveGrid } from '@/features/hooks/useResponsiveGrid';
import { useAlgoController, useMazeGenerator } from '@/features/animations';
import { mazes } from '@/features/mazes';
import { algoRegistry, algorithmMap } from '@/features/algo';
import { Stats } from './Stats';
import { Legend } from './Legend';
import { InfoModal } from './InfoModal';
import { useInfoModal } from '@/features/hooks/useInfoModal';
import { useGridStore, useSettingsStore } from '@/features/store';
import { DEFAULT_WEIGHT } from '@/utils/constants';

export default function GridPage() {
    const gridRef = useRef<CanvasGridHandle>(null);
    const boxRef = useRef<HTMLDivElement>(null);
    const { modalOpen, toggleModal, onModalClosed } = useInfoModal();
    const algoController = useAlgoController(gridRef, algorithmMap, {
        animatePath: true,
    });
    const mazeGenerator = useMazeGenerator(mazes);
    const drawTool = useSettingsStore((s) => s.tool);

    const shortest = useSettingsStore((s) => {
        const currAlgo = s.algoKey;
        const algo = algoRegistry.find((entry) => entry.label === currAlgo);
        if (!algo) return null;
        return algo.shortest;
    });
    const selectedAlgo = useSettingsStore((s) => s.algoKey);
    const gridHasWeights = useGridStore((s) => s.weights.some((w) => w !== DEFAULT_WEIGHT));

    useResponsiveGrid(boxRef);

    return (
        <div className="page">
            <InfoModal open={modalOpen} onModalClosed={onModalClosed} />
            <Toolbar
                className="[grid-area:header]"
                algo={algoController}
                maze={mazeGenerator}
                toggleModal={toggleModal}
            />

            <main className="[grid-area:grid] min-h-0 min-w-0 p-4 flex">
                <div
                    ref={boxRef}
                    className="flex-1 min-h-0 min-w-0 overflow-auto flex items-center-safe justify-center-safe"
                >
                    <CanvasGrid ref={gridRef} />
                </div>
            </main>

            <Stats
                algo={algoController.runAlgo}
                selectedAlgo={selectedAlgo}
                status={algoController.status}
                visited={algoController.visitedApprox}
                pathLen={algoController.pathLen}
                pathCost={algoController.pathCost}
                shortest={shortest}
                gridHasWeights={gridHasWeights}
                className="[grid-area:stats] p-4"
            />
            <Legend
                tool={drawTool}
                onSelectTool={useSettingsStore.getState().setTool}
                className="[grid-area:legend] p-4"
            />

            <div className="[grid-area:controls] bg-primary flex items-center px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] xl:justify-end xl:py-2">
                <PlaybackControls algo={algoController} />
            </div>
        </div>
    );
}
