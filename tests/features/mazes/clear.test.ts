import { describe, expect, it } from 'vitest';
import { clearBoard, clearWalls, clearWeights } from '@/features/mazes/clear';
import { runMaze } from '../../helpers/grid';

const ROWS = 5;
const COLS = 7;
const types = (gen: typeof clearWalls) => runMaze(gen, ROWS, COLS).map((e) => e.type);

describe('clear actions', () => {
    it('Clear Walls only resets walls', () => {
        expect(types(clearWalls)).toEqual(['clear-wall', 'done']);
    });

    it('Clear Weights only resets weights', () => {
        expect(types(clearWeights)).toEqual(['clear-weights', 'done']);
    });

    it('Clear Board resets both', () => {
        expect(types(clearBoard)).toEqual(['clear-wall', 'clear-weights', 'done']);
    });
});
