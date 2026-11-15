import { describe, expect, it } from 'vitest';
import { Queue } from '@/lib/data-structures/queue';

describe('Queue', () => {
    it('pops in FIFO order', () => {
        const q = new Queue<number>();
        [1, 2, 3].forEach((x) => q.push(x));
        expect([q.pop(), q.pop(), q.pop()]).toEqual([1, 2, 3]);
    });

    it('returns undefined from pop/peek when empty', () => {
        const q = new Queue<number>();
        expect(q.pop()).toBeUndefined();
        expect(q.peek()).toBeUndefined();
        expect(q.isEmpty()).toBe(true);
        expect(q.size()).toBe(0);
    });

    it('peeks without removing', () => {
        const q = new Queue<string>();
        q.push('a');
        q.push('b');
        expect(q.peek()).toBe('a');
        expect(q.size()).toBe(2);
    });

    it('rejects a non-positive capacity', () => {
        expect(() => new Queue(0)).toThrow('capacity must be > 0');
        expect(() => new Queue(-4)).toThrow();
    });

    it('grows past its initial capacity and keeps order', () => {
        const q = new Queue<number>(2);
        for (let i = 0; i < 100; i++) q.push(i);
        expect(q.size()).toBe(100);
        for (let i = 0; i < 100; i++) expect(q.pop()).toBe(i);
    });

    // Interleaving moves head/tail around the ring, so growing must unwrap it correctly
    it('keeps order when growing while the buffer is wrapped', () => {
        const q = new Queue<number>(4);
        const expected: number[] = [];
        let next = 0;
        for (let round = 0; round < 50; round++) {
            q.push(next);
            expected.push(next++);
            q.push(next);
            expected.push(next++);
            q.push(next);
            expected.push(next++);
            expect(q.pop()).toBe(expected.shift());
        }
        while (!q.isEmpty()) expect(q.pop()).toBe(expected.shift());
        expect(expected).toHaveLength(0);
    });

    it.each([true, false])('clear(preserveCapacity=%s) empties the queue and stays usable', (preserve) => {
        const q = new Queue<number>(4);
        for (let i = 0; i < 10; i++) q.push(i);
        q.clear(preserve);
        expect(q.isEmpty()).toBe(true);
        expect(q.pop()).toBeUndefined();
        q.push(42);
        expect(q.pop()).toBe(42);
    });
});
