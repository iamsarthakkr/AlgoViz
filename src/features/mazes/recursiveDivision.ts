// Authored by - Sarthak Kumar
//
// recursiveDivision: a *factory* (verticalProb) -> MazeGenerator. Recursively bisects
// the interior with single-gap walls (vertical or horizontal, weighted by verticalProb),
// using explicit stacks instead of recursion. mazes/registry.ts calls this 3x with different
// skew probabilities to register three distinct dropdown entries from one implementation.

import { MazeGenerator } from '@/types/mazeGenerator';
import { randomEven, randomOdd } from '@/features/algo/utils';

type Range = {
    from: number;
    to: number;
};

// recursive Division maze generator
export const recursiveDivision = (verticalProb: number = 0.5): MazeGenerator =>
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

        const rowStack: Range[] = [];
        const colStack: Range[] = [];

        rowStack.push({ from: 1, to: rows - 2 });
        colStack.push({ from: 1, to: cols - 2 });

        while (rowStack.length > 0) {
            const { from: rowFrom, to: rowTo } = rowStack[rowStack.length - 1];
            const { from: colFrom, to: colTo } = colStack[colStack.length - 1];
            rowStack.pop();
            colStack.pop();

            if (rowTo - rowFrom < 2 || colTo - colFrom < 2) {
                continue;
            }

            // pick wall
            const p = Math.random();
            if (p <= verticalProb) {
                // draw vertical wall
                const c = randomEven(colFrom, colTo); // at even column
                const r = randomOdd(rowFrom, rowTo); // carve at odd col

                for (let rr = rowFrom; rr <= rowTo; rr++) {
                    if (rr === r) continue;
                    yield { type: 'wall', at: { r: rr, c } };
                }

                rowStack.push({ from: rowFrom, to: rowTo });
                colStack.push({ from: colFrom, to: c - 1 });

                rowStack.push({ from: rowFrom, to: rowTo });
                colStack.push({ from: c + 1, to: colTo });
            } else {
                // draw horizontal wall
                const r = randomEven(rowFrom, rowTo); // at even row
                const c = randomOdd(colFrom, colTo); // carve at odd col

                for (let cc = colFrom; cc <= colTo; cc++) {
                    if (cc === c) continue;
                    yield { type: 'wall', at: { r, c: cc } };
                }

                rowStack.push({ from: rowFrom, to: r - 1 });
                colStack.push({ from: colFrom, to: colTo });

                rowStack.push({ from: r + 1, to: rowTo });
                colStack.push({ from: colFrom, to: colTo });
            }
        }

        yield { type: 'done' };
    };
