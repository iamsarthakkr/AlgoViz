// Authored by - Sarthak Kumar
//
// Queue: ring-buffer FIFO queue (power-of-2 capacity, doubles on overflow).
// Used by bfs/bidirectionalBfs as the frontier structure.

export class Queue<T> {
    private buf: (T | undefined)[];
    private head = 0;
    private tail = 0;
    private _size = 0;

    constructor(initialCapacity = 16) {
        if (initialCapacity <= 0) throw new Error('capacity must be > 0');
        const cap = 1 << Math.ceil(Math.log2(initialCapacity));
        this.buf = new Array<T | undefined>(cap);
    }

    push(x: T): void {
        if (this._size === this.buf.length) this.grow();
        this.buf[this.tail] = x;
        this.tail = (this.tail + 1) & (this.buf.length - 1);
        this._size++;
    }

    pop(): T | undefined {
        if (this._size === 0) return undefined;
        const val = this.buf[this.head];
        this.buf[this.head] = undefined;
        this.head = (this.head + 1) & (this.buf.length - 1);
        this._size--;
        return val;
    }

    peek(): T | undefined {
        return this._size ? (this.buf[this.head] as T) : undefined;
    }

    isEmpty(): boolean {
        return this._size === 0;
    }

    size(): number {
        return this._size;
    }

    clear(preserveCapacity = true): void {
        if (preserveCapacity) {
            this.buf.fill(undefined);
            this.head = this.tail = this._size = 0;
        } else {
            this.buf = new Array(16);
            this.head = this.tail = this._size = 0;
        }
    }

    private grow(): void {
        const newCap = this.buf.length << 1;
        const next = new Array<T | undefined>(newCap);
        for (let i = 0; i < this._size; i++) {
            next[i] = this.buf[(this.head + i) & (this.buf.length - 1)];
        }
        this.buf = next;
        this.head = 0;
        this.tail = this._size;
    }
}
