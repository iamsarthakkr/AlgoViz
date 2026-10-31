import { describe, expect, it } from 'vitest';
import {
    equal,
    neighbors4,
    pathCost,
    random,
    randomEven,
    randomOdd,
    second_neighbors4,
    shuffle,
} from '@/features/algo/utils';
import { DEFAULT_WEIGHT, WEIGHT_LEVELS } from '@/utils/constants';
import { parseGrid } from '../../helpers/grid';
import { fixRandom, seedRandom } from '../../helpers/random';

describe('random helpers', () => {
    it('random covers both ends of an inclusive range', () => {
        fixRandom(0);
        expect(random(3, 7)).toBe(3);
        fixRandom(0.999999);
        expect(random(3, 7)).toBe(7);
    });

    it('randomOdd always returns an odd number inside the range', () => {
        seedRandom(1);
        for (let i = 0; i < 200; i++) {
            const v = randomOdd(2, 11);
            expect(v % 2).toBe(1);
            expect(v).toBeGreaterThanOrEqual(3);
            expect(v).toBeLessThanOrEqual(11);
        }
    });

    it('randomEven always returns an even number inside the range', () => {
        seedRandom(2);
        for (let i = 0; i < 200; i++) {
            const v = randomEven(1, 10);
            expect(v % 2).toBe(0);
            expect(v).toBeGreaterThanOrEqual(2);
            expect(v).toBeLessThanOrEqual(10);
        }
    });

    it('throws when the range has no odd/even number', () => {
        expect(() => randomOdd(2, 2)).toThrow('No odd number in range');
        expect(() => randomEven(3, 3)).toThrow('No even number in range');
    });
});

describe('shuffle', () => {
    it('keeps the same elements', () => {
        seedRandom(3);
        const items = Array.from({ length: 20 }, (_, i) => ({ r: i, c: 0 }));
        const copy = items.slice();
        shuffle(copy);
        expect(copy).toHaveLength(items.length);
        expect(new Set(copy)).toEqual(new Set(items));
    });

    it('can leave an element in its original position (unbiased Fisher–Yates)', () => {
        seedRandom(4);
        let sawFixedPoint = false;
        for (let i = 0; i < 200 && !sawFixedPoint; i++) {
            const a = [
                { r: 0, c: 0 },
                { r: 1, c: 0 },
            ];
            const first = a[0];
            shuffle(a);
            sawFixedPoint = a[0] === first;
        }
        expect(sawFixedPoint).toBe(true);
    });
});

describe('coordinate helpers', () => {
    it('equal compares by value', () => {
        expect(equal({ r: 1, c: 2 }, { r: 1, c: 2 })).toBe(true);
        expect(equal({ r: 1, c: 2 }, { r: 2, c: 1 })).toBe(false);
    });

    it('neighbors4 returns up, right, down, left', () => {
        expect(neighbors4({ r: 5, c: 5 })).toEqual([
            { r: 4, c: 5 },
            { r: 5, c: 6 },
            { r: 6, c: 5 },
            { r: 5, c: 4 },
        ]);
    });

    it('second_neighbors4 returns cells two steps away', () => {
        expect(second_neighbors4({ r: 5, c: 5 })).toEqual([
            { r: 3, c: 5 },
            { r: 5, c: 7 },
            { r: 7, c: 5 },
            { r: 5, c: 3 },
        ]);
    });
});

describe('pathCost', () => {
    const grid = parseGrid(['S1', '2G']);
    const [LIGHT] = WEIGHT_LEVELS;
    const path = [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 1, c: 1 },
    ];

    // the cost is paid on entering a cell, and a path never enters its first cell
    it('sums the weight of every cell after the first', () => {
        expect(pathCost(path, grid)).toBe(LIGHT + DEFAULT_WEIGHT);
    });

    it('is 0 for a single cell or an empty path', () => {
        expect(pathCost(path.slice(0, 1), grid)).toBe(0);
        expect(pathCost([], grid)).toBe(0);
    });
});
