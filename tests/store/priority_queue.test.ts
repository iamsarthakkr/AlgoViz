import { describe, expect, it } from 'vitest';
import { min_priority_queue } from '@/store/priority_queue';

type Entry = { dist: number; id: number };
const byDist = () => new min_priority_queue<Entry>((a, b) => a.dist < b.dist);
import { seedRandom } from '../helpers/random';

describe('min_priority_queue', () => {
    it('returns null when empty', () => {
        const pq = byDist();
        expect(pq.pop()).toBeNull();
        expect(pq.empty()).toBe(true);
        expect(pq.size()).toBe(0);
    });

    it('pops the smallest dist first', () => {
        const pq = byDist();
        pq.push({ dist: 5, id: 50 });
        pq.push({ dist: 1, id: 10 });
        pq.push({ dist: 3, id: 30 });
        expect(pq.pop()).toEqual({ dist: 1, id: 10 });
        expect(pq.pop()).toEqual({ dist: 3, id: 30 });
        expect(pq.pop()).toEqual({ dist: 5, id: 50 });
        expect(pq.empty()).toBe(true);
    });

    it('keeps duplicate distances (dijkstra pushes stale entries)', () => {
        const pq = byDist();
        pq.push({ dist: 2, id: 1 });
        pq.push({ dist: 2, id: 2 });
        pq.push({ dist: 2, id: 3 });
        expect(pq.size()).toBe(3);
        const ids = [pq.pop()!.id, pq.pop()!.id, pq.pop()!.id].sort();
        expect(ids).toEqual([1, 2, 3]);
    });

    it('drains in sorted order for random input', () => {
        seedRandom(7);
        const pq = byDist();
        const values = Array.from({ length: 500 }, () => Math.floor(Math.random() * 1000));
        values.forEach((d, i) => pq.push({ dist: d, id: i }));

        const drained: number[] = [];
        while (!pq.empty()) drained.push(pq.pop()!.dist);
        expect(drained).toEqual([...values].sort((a, b) => a - b));
    });

    // equal entries must stay put: a swap on a tie would make the newest always win, and reorder
    // dijkstra's run for no reason
    it('does not move a new entry past an equal parent', () => {
        const pq = byDist();
        pq.push({ dist: 1, id: 1 });
        pq.push({ dist: 1, id: 2 });
        expect(pq.pop()!.id).toBe(1);
    });

    describe('with a two-key comparator', () => {
        type Tied = Entry & { tie: number };
        const byDistThenTie = () =>
            new min_priority_queue<Tied>((a, b) => (a.dist !== b.dist ? a.dist < b.dist : a.tie < b.tie));

        it('breaks equal distances on the second key', () => {
            const pq = byDistThenTie();
            pq.push({ dist: 5, id: 1, tie: 3 });
            pq.push({ dist: 5, id: 2, tie: 1 });
            pq.push({ dist: 5, id: 3, tie: 2 });
            expect([pq.pop()!.id, pq.pop()!.id, pq.pop()!.id]).toEqual([2, 3, 1]);
        });

        it('lets the first key win over the second', () => {
            const pq = byDistThenTie();
            pq.push({ dist: 6, id: 1, tie: 0 });
            pq.push({ dist: 5, id: 2, tie: 9 });
            expect(pq.pop()!.id).toBe(2);
        });
    });
});
