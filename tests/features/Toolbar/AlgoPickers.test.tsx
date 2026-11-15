import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlgoPickers } from '@/features/Toolbar/AlgoPickers';
import { useSettingsStore } from '@/features/store';
import { algoLabels } from '@/features/algo';
import { mazeRegistry, mazeSections } from '@/features/mazes';
import { fakeAlgoController, fakeMazeGenerator } from '../../helpers/controllers';

const dropdown = (title: string) => screen.getByRole('button', { name: title }).parentElement!;
// by the clickable option, as a section header can share its label
const option = (label: string) => within(dropdown('Mazes & Patterns')).getByText(label, { selector: 'a' });

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

    describe('maze menu', () => {
        it('groups every entry under its section', () => {
            setup();
            const menu = dropdown('Mazes & Patterns');
            for (const section of mazeSections) {
                const summary = [...menu.querySelectorAll('summary')].find((s) => s.textContent === section.title)!;
                const details = summary.closest('details')!;
                for (const label of section.options)
                    expect(within(details).getByText(label, { selector: 'a' })).toBeInTheDocument();
            }
        });

        // Clear and Terrain go through the same path as a maze, not only the first entry
        it.each(mazeRegistry.map((e) => e.label))('picking %s clears the path and runs it', async (label) => {
            const { algo, maze, user } = setup();
            await user.click(option(label));
            expect(algo.clear).toHaveBeenCalledOnce();
            expect(maze.generate).toHaveBeenCalledExactlyOnceWith(label);
        });

        // the trigger is the rightmost control on phones: left-aligned, the menu runs off the screen
        it('aligns to the right on phones and to the left on desktop', () => {
            setup();
            expect(dropdown('Mazes & Patterns')).toHaveClass('d-dropdown-end', 'xl:d-dropdown-start');
        });
    });
});
