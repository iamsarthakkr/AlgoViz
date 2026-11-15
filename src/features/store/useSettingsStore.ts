// Authored by - Sarthak Kumar
//
// useSettingsStore: UI/session state, separate from grid data.
// - The user's selections: algorithm key, speed preset and draw tool. This is the only copy: the
//   pickers write here; useAlgoController reads the speed live and the algorithm when a run starts,
//   and CanvasGrid reads the tool when a drag starts

import { create } from 'zustand';
import { SettingsState } from '@/types/settings';
import { algoLabels } from '@/features/algo';

export const useSettingsStore = create<SettingsState>((set) => {
    return {
        algoKey: algoLabels[0],
        speed: 'medium',

        tool: { type: 'wall' },

        setAlgoKey: (algoKey) => set({ algoKey }),
        setSpeed: (speed) => set({ speed }),

        setTool: (tool) => set({ tool }),
    };
});
