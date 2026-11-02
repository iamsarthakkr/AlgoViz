// Authored by - Sarthak Kumar
//
// sequence: chains generators into one, with a single `done` at the very end. Each starts only when
// the one before has finished, so its getCells sees what that one built.

import { MazeGenerator } from '@/types/mazeGenerator';

export const sequence = (...generators: MazeGenerator[]): MazeGenerator =>
    function* (rows, cols, getCells) {
        for (const gen of generators) {
            for (const event of gen(rows, cols, getCells)) {
                if (event.type !== 'done') {
                    yield event;
                }
            }
        }
        yield { type: 'done' };
    };
