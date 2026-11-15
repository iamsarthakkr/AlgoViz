// Authored by - Sarthak Kumar
//
// painters barrel: pure canvas drawing functions (base scene, markers, overlay events) and the palette.

export { drawStartMarker, drawGoalMarker, drawMarkers, drawBaseScene, drawWeightDots } from './basePainter';
export { paintAlgoEvent, animateFinalPath, clearOverlay } from './overlayPainter';
export { lightPalette, darkPalette, weightColor, weightLevel } from './colors';
export type { GridPalette } from './colors';
