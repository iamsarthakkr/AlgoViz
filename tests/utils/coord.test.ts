import { describe, expect, it } from 'vitest';
import { distance, equal, getCoord, getId, inBounds, isWall } from '@/utils/coord';
import { CellKind } from '@/types/grid';

describe('coord', () => {
    it('flattens a coordinate to its row-major index', () => {
        expect(getId({ r: 0, c: 0 }, 7)).toBe(0);
        expect(getId({ r: 2, c: 3 }, 7)).toBe(2 * 7 + 3);
    });

    it('getCoord undoes getId for every cell', () => {
        const rows = 3;
        const cols = 7;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                expect(getCoord(getId({ r, c }, cols), cols)).toEqual({ r, c });
            }
        }
    });

    it('isWall is true only for wall cells', () => {
        const cells = [CellKind.empty, CellKind.wall, CellKind.empty];
        expect(cells.map((_, id) => isWall(cells, id))).toEqual([false, true, false]);
    });

    it('equal compares by value', () => {
        expect(equal({ r: 1, c: 2 }, { r: 1, c: 2 })).toBe(true);
        expect(equal({ r: 1, c: 2 }, { r: 2, c: 1 })).toBe(false);
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
