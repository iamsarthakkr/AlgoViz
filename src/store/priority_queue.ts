// Authored by - Sarthak Kumar
//
// min_priority_queue: binary min-heap ordered by a caller's comparator, so each algorithm picks its
// own keys. The frontier for dijkstra (distance) and astar (f, then h).

export type Comparator<T> = (a: T, b: T) => boolean;

export class min_priority_queue<T> {
    private _heap: T[] = [];
    private _less: Comparator<T>;

    constructor(less: Comparator<T>) {
        this._less = less;
    }

    push(val: T) {
        this._heap.push(val);
        this.up(this._heap.length - 1);
    }

    pop(): T | null {
        const h = this._heap;
        if (!h.length) return null;
        const top = h[0];
        const last = h.pop()!;
        if (h.length) {
            h[0] = last;
            this.down(0);
        }
        return top;
    }

    size() {
        return this._heap.length;
    }

    empty() {
        return this._heap.length === 0;
    }

    private swap(i: number, j: number) {
        const h = this._heap;
        const tmp = h[i];
        h[i] = h[j];
        h[j] = tmp;
    }

    private up(i: number) {
        const h = this._heap;
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (!this._less(h[i], h[p])) break;
            this.swap(i, p);
            i = p;
        }
    }

    private down(i: number) {
        const h = this._heap;
        const n = h.length;
        while (true) {
            const left = (i << 1) + 1;
            const right = left + 1;
            let smallest = i;

            if (left < n && this._less(h[left], h[smallest])) smallest = left;
            if (right < n && this._less(h[right], h[smallest])) smallest = right;
            if (smallest === i) break;
            this.swap(i, smallest);
            i = smallest;
        }
    }
}
