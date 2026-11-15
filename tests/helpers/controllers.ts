import { vi } from 'vitest';
import type { AlgoController, MazeGeneratorApi } from '@/features/animations';
import { algoLabels } from '@/features/algo';

// Stand-ins for the controller and maze generator that ui/Grid.tsx owns, so the toolbar
// components can be tested in any state without running an algorithm.
export function fakeAlgoController(overrides: Partial<AlgoController> = {}): AlgoController {
    return {
        runAlgo: algoLabels[0],
        status: undefined,
        pathLen: undefined,
        visitedApprox: 0,
        pathCost: undefined,
        clear: vi.fn(),
        play: vi.fn(),
        pause: vi.fn(),
        step: vi.fn(),
        skipToEnd: vi.fn(),
        ...overrides,
    };
}

export function fakeMazeGenerator(): MazeGeneratorApi {
    return { generate: vi.fn() };
}
