// Authored by - Sarthak Kumar
//
// settings types: the speed presets and the shape of useSettingsStore (the user's selections, incl. the draw tool).

import { DrawTool } from './grid';

export type SpeedPreset = 'slow' | 'medium' | 'fast';

export type SettingsState = {
    algoKey: string;
    speed: SpeedPreset;

    tool: DrawTool;

    // actions
    setAlgoKey: (k: string) => void;
    setSpeed: (s: SpeedPreset) => void;

    setTool: (tool: DrawTool) => void;
};
