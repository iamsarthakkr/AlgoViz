// Authored by - Sarthak Kumar
//
// recursiveDivision: a *factory* (vertical_prob) -> MazeGenerator. Recursively bisects
// the interior with single-gap walls (vertical or horizontal, weighted by vertical_prob),
// using explicit stacks instead of recursion. mazes/registry.ts calls this 3x with different
// skew probabilities to register three distinct dropdown entries from one implementation.

import { MazeGenerator } from '@/types/mazeGenerator';
import { randomEven, randomOdd } from '@/features/algo/utils';

type Range = {
    from: number;
    to: number;
};

// recursive Division maze generator
export const recursiveDivision = (vertical_prob: number = 0.5): MazeGenerator =>
    function* (rows, cols) {
        yield { type: 'clear-wall' };
        yield { type: 'clear-weights' };

        // set boundary
        // top
        for (let c = 0; c < cols; c++) {
            yield { type: 'wall', at: { r: 0, c } };
        }
        // right
        for (let r = 0; r < rows; r++) {
            yield { type: 'wall', at: { r, c: cols - 1 } };
        }
        // bottom
        for (let c = cols - 1; c >= 0; c--) {
            yield { type: 'wall', at: { r: rows - 1, c } };
        }
        // left
        for (let r = rows - 1; r >= 0; r--) {
            yield { type: 'wall', at: { r, c: 0 } };
        }

        const row_stack: Range[] = [];
        const col_stack: Range[] = [];

        row_stack.push({ from: 1, to: rows - 2 });
        col_stack.push({ from: 1, to: cols - 2 });

        while (row_stack.length > 0) {
            const { from: row_from, to: row_to } = row_stack[row_stack.length - 1];
            const { from: col_from, to: col_to } = col_stack[col_stack.length - 1];
            row_stack.pop();
            col_stack.pop();

            if (row_to - row_from < 2 || col_to - col_from < 2) {
                continue;
            }

            // pick wall
            const p = Math.random();
            if (p <= vertical_prob) {
                // draw vertical wall
                const c = randomEven(col_from, col_to); // at even column
                const r = randomOdd(row_from, row_to); // carve at odd col

                for (let rr = row_from; rr <= row_to; rr++) {
                    if (rr === r) continue;
                    yield { type: 'wall', at: { r: rr, c } };
                }

                row_stack.push({ from: row_from, to: row_to });
                col_stack.push({ from: col_from, to: c - 1 });

                row_stack.push({ from: row_from, to: row_to });
                col_stack.push({ from: c + 1, to: col_to });
            } else {
                // draw horizontal wall
                const r = randomEven(row_from, row_to); // at even row
                const c = randomOdd(col_from, col_to); // carve at odd col

                for (let cc = col_from; cc <= col_to; cc++) {
                    if (cc === c) continue;
                    yield { type: 'wall', at: { r, c: cc } };
                }

                row_stack.push({ from: row_from, to: r - 1 });
                col_stack.push({ from: col_from, to: col_to });

                row_stack.push({ from: r + 1, to: row_to });
                col_stack.push({ from: col_from, to: col_to });
            }
        }

        yield { type: 'done' };
    };
