import { describe, expect, it } from 'vitest';
import { distance, getId, inBounds } from '@/utils/coord';

describe('coord', () => {
    it('flattens a coordinate to its row-major index', () => {
        expect(getId({ r: 0, c: 0 }, 7)).toBe(0);
        expect(getId({ r: 2, c: 3 }, 7)).toBe(2 * 7 + 3);
    });

    it.each([
        [{ r: 0, c: 0 }, true],
        [{ r: 2, c: 3 }, true],
        [{ r: -1, c: 0 }, false],
        [{ r: 0, c: -1 }, false],
        [{ r: 3, c: 0 }, false],
        [{ r: 0, c: 4 }, false],
    ])('inBounds %o on a 3x4 grid is %s', (coord, expected) => {
        expect(inBounds(coord, 3, 4)).toBe(expected);
    });

    it('measures the straight-line distance', () => {
        expect(distance({ r: 1, c: 1 }, { r: 4, c: 5 })).toBe(Math.hypot(3, 4));
        expect(distance({ r: 2, c: 2 }, { r: 2, c: 2 })).toBe(0);
    });
});
