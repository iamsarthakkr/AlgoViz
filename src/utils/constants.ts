// Authored by - Sarthak Kumar
//
// constants: grid sizing limits for utils/layout.ts, and the initial grid the store starts with
// before useResponsiveGrid measures the page and picks the real dimensions.

// initial grid (the store's default); replaced on load by pickGridLayout
export const ROWS = 35;
export const COLS = 61;
export const CELL_SIZE = 20;

// size range for cells in px
export const MIN_CELL = 12;
export const MAX_CELL = 32;

export const MIN_ROWS = 11;
export const MAX_ROWS = 41;
export const COL_PRESETS: readonly number[] = [21, 35, 41, 51]; // cols presets, chosen by how wide the grid's box actually is
export const TARGET_CELL = 24; // "comfortable" cell size in px

// light / medium / heavy weight levels (the palette has one tint per level, in this order).
// Nothing may cost less than DEFAULT_WEIGHT: A* assumes every step costs at least that
export const DEFAULT_WEIGHT = 1;
export const WEIGHT_LEVELS: readonly number[] = [2, 5, 10];
export const WEIGHT_LEVEL_NAMES: readonly string[] = ['Light', 'Medium', 'Heavy'];
