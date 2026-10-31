import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stats } from '@/ui/Stats';
import { algoLabels } from '@/features/algo';
import { AlgoStatus } from '@/types/algo';

type StatsProps = Parameters<typeof Stats>[0];

// what a run that hasn't started yet looks like
const IDLE: StatsProps = {
    algo: '',
    selectedAlgo: algoLabels[0],
    status: undefined,
    visited: 0,
    pathLen: undefined,
    pathCost: undefined,
    shortest: 'unweighted-only',
    gridHasWeights: false,
};
// a finished run on an open grid: start and goal 4 apart, so 5 path cells
const DONE: StatsProps = {
    ...IDLE,
    algo: algoLabels[0],
    status: AlgoStatus.done,
    visited: 12,
    pathLen: 5,
    pathCost: 9,
};

const LABELS = ['Algo', 'Status', 'Visited', 'Path', 'Cost'];
const PLACEHOLDER = /^[-—]$/; // a lone dash: "nothing yet"

const renderStats = (props: Partial<StatsProps> = {}) => render(<Stats {...IDLE} {...props} />);
// the <dd> paired with a <dt> label
const value = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling as HTMLElement;
const labels = () => screen.getAllByRole('term').map((dt) => dt.textContent);

describe('Stats', () => {
    it('is a labelled side region the page can place', () => {
        renderStats({ className: '[grid-area:stats]' });
        expect(screen.getByRole('complementary', { name: 'Stats' })).toHaveClass('[grid-area:stats]');
    });

    // On phones the stats sit in an `auto` grid row: if items appeared or disappeared during a run,
    // the row would change height, the grid would be resized, and the run would stop. jsdom can't
    // measure that, so check the structure: the same items render whatever the state.
    it.each([undefined, AlgoStatus.initial, AlgoStatus.running, AlgoStatus.paused, AlgoStatus.done])(
        'renders the same items when status is %s',
        (status) => {
            renderStats({ ...DONE, status });
            expect(labels()).toEqual(LABELS);
        },
    );

    it('shows placeholders before any run', () => {
        renderStats();
        expect(value('Algo').textContent).toMatch(PLACEHOLDER);
        expect(value('Status').textContent).toMatch(PLACEHOLDER);
        expect(value('Visited')).toHaveTextContent(String(IDLE.visited));
        expect(value('Path').textContent).toMatch(PLACEHOLDER);
    });

    it.each([
        [AlgoStatus.initial, 'Ready'],
        [AlgoStatus.running, 'Running'],
        [AlgoStatus.paused, 'Paused'],
        [AlgoStatus.done, 'Finished'],
    ])('labels status %s as %s', (status, label) => {
        renderStats({ ...DONE, status });
        expect(value('Status')).toHaveTextContent(label);
    });

    it('shows the run’s algorithm and visited count', () => {
        renderStats(DONE);
        expect(value('Algo')).toHaveTextContent(DONE.algo);
        expect(value('Visited')).toHaveTextContent(String(DONE.visited));
    });

    // pathLen counts cells, both endpoints included; a length is the number of moves between them
    it('shows the path length in steps, not cells', () => {
        renderStats(DONE);
        expect(value('Path')).toHaveTextContent(String(DONE.pathLen! - 1));
    });

    it('shows the path cost', () => {
        renderStats(DONE);
        expect(value('Cost')).toHaveTextContent(String(DONE.pathCost));
    });

    it('shows placeholders for the path and its cost until one is found', () => {
        renderStats({ ...DONE, status: AlgoStatus.running, pathLen: undefined, pathCost: undefined });
        expect(value('Path').textContent).toMatch(PLACEHOLDER);
        expect(value('Cost').textContent).toMatch(PLACEHOLDER);
    });

    // the controller reports pathLen 0 when the run finished without reaching the goal; the run
    // still finished, so the status stays "Finished" and the path cell says there is none
    describe('when no path exists', () => {
        const noPath = { ...DONE, pathLen: 0, pathCost: 0 };

        it('says so in the path cell, not as a negative length', () => {
            renderStats(noPath);
            // 0 cells minus one would read as a path of -1 steps
            expect(value('Path')).toHaveTextContent('No path');
        });

        // the path cell already says so, and 0 would read as a free path
        it('shows a placeholder for the cost', () => {
            renderStats(noPath);
            expect(value('Cost').textContent).toMatch(PLACEHOLDER);
        });

        it('still reports the run as finished', () => {
            renderStats(noPath);
            expect(value('Status')).toHaveTextContent('Finished');
        });
    });

    // status changes are worth announcing; the visited count changes every frame and would flood a
    // screen reader, so only the status is a live region
    it('announces status changes, and only those', () => {
        const { container } = renderStats(DONE);
        const live = container.querySelectorAll('[aria-live]');
        expect(live).toHaveLength(1);
        expect(live[0]).toBe(value('Status'));
        expect(live[0]).toHaveAttribute('aria-live', 'polite');
    });

    // The note describes the selected algorithm, which can change mid-run. On phones this panel is an
    // `auto` grid row, so its size must not follow the text, or the grid resizes and the run stops.
    describe('algorithm note', () => {
        const note = (container: HTMLElement) => container.querySelector('p')!;
        const selectedAlgo = 'Some algorithm';

        it.each([
            ['always', /always finds the cheapest path/],
            ['unweighted-only', /ignores weights, so its path may not be the cheapest/],
            ['never', /finds a path, not necessarily the shortest/],
        ] as const)('explains "%s" for the selected algorithm', (shortest, text) => {
            const { container } = renderStats({ shortest, selectedAlgo });
            expect(note(container)).toHaveTextContent(text);
            expect(note(container)).toHaveTextContent(selectedAlgo);
        });

        // red means "on this grid, the path may not be the cheapest"
        it.each([
            ['always', false, false],
            ['always', true, false],
            ['unweighted-only', false, false], // ignoring weights is harmless without any
            ['unweighted-only', true, true],
            ['never', false, true], // not shortest even on a plain grid
            ['never', true, true],
        ] as const)('"%s" with weights=%s warns in red: %s', (shortest, gridHasWeights, red) => {
            const { container } = renderStats({ shortest, gridHasWeights });
            if (red) expect(note(container)).toHaveClass('text-red-700');
            else expect(note(container)).not.toHaveClass('text-red-700');
        });

        it('sits outside the stat cells, so it gets the full width', () => {
            const { container } = renderStats();
            expect(note(container).closest('dl')).toBeNull();
        });

        it('has a fixed height on phones, for any text', () => {
            const { container } = renderStats();
            expect(note(container)).toHaveClass('h-8', 'line-clamp-2');
        });

        it('still reserves its space with nothing to say', () => {
            const { container } = renderStats({ shortest: null });
            expect(note(container)).toBeInTheDocument();
            expect(note(container)).toHaveTextContent('');
        });
    });
});
