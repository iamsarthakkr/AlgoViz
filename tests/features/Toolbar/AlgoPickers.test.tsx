import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlgoPickers } from '@/features/Toolbar/AlgoPickers';
import { useSettingsStore } from '@/features/store';
import { algoLabels } from '@/features/algo';
import { mazeRegistry } from '@/features/mazes';
import { fakeAlgoController, fakeMazeGenerator } from '../../helpers/controllers';

const dropdown = (title: string) => screen.getByRole('button', { name: title }).parentElement!;

describe('AlgoPickers', () => {
    const setup = () => {
        const algo = fakeAlgoController();
        const maze = fakeMazeGenerator();
        render(<AlgoPickers algo={algo} maze={maze} />);
        return { algo, maze, user: userEvent.setup() };
    };

    it('shows the selected algorithm and the maze menu', () => {
        setup();
        expect(screen.getByRole('button', { name: useSettingsStore.getState().algoKey })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Mazes & Patterns' })).toBeInTheDocument();
    });

    // picking only changes the selection: a run in progress is left alone (the controller reads the
    // selection when the next run starts)
    it('writes the selected algorithm to the store and touches no run', async () => {
        const { algo, user } = setup();
        const next = algoLabels[1];
        await user.click(within(dropdown(algoLabels[0])).getByText(next));

        expect(useSettingsStore.getState().algoKey).toBe(next);
        expect(screen.getByRole('button', { name: next })).toBeInTheDocument();
        for (const control of [algo.play, algo.pause, algo.step, algo.skipToEnd, algo.clear]) {
            expect(control).not.toHaveBeenCalled();
        }
    });

    // the old path must be cleared before the maze starts writing walls under it
    it('clears the current path, then generates the chosen maze', async () => {
        const { algo, maze, user } = setup();
        const key = mazeRegistry[0].label;
        await user.click(within(dropdown('Mazes & Patterns')).getByText(key));

        expect(maze.generate).toHaveBeenCalledWith(key);
        const [cleared] = vi.mocked(algo.clear).mock.invocationCallOrder;
        const [generated] = vi.mocked(maze.generate).mock.invocationCallOrder;
        expect(cleared).toBeLessThan(generated);
    });
});
