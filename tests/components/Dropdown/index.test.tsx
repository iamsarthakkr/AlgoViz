import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from '@/components/Dropdown';

describe('Dropdown', () => {
    it('shows the title and every option', () => {
        render(<Dropdown title="Pick one" options={['a', 'b', 'c']} onSelect={vi.fn()} />);
        expect(screen.getByRole('button', { name: 'Pick one' })).toBeInTheDocument();
        expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['a', 'b', 'c']);
    });

    it('calls onSelect with the clicked option', async () => {
        const onSelect = vi.fn();
        render(<Dropdown title="Pick" options={['a', 'b']} onSelect={onSelect} />);
        await userEvent.click(screen.getByText('b'));
        expect(onSelect).toHaveBeenCalledWith('b');
    });

    // daisyUI dropdowns stay open while focused, so selecting must blur to close the menu
    it('blurs the focused element shortly after selecting so the menu closes', () => {
        vi.useFakeTimers();
        try {
            render(<Dropdown title="Pick" options={['a']} onSelect={vi.fn()} />);
            const trigger = screen.getByRole('button', { name: 'Pick' });
            trigger.focus();
            screen.getByText('a').click();
            expect(trigger).toHaveFocus();
            act(() => vi.advanceTimersByTime(10));
            expect(trigger).not.toHaveFocus();
        } finally {
            vi.useRealTimers();
        }
    });

    // placement is passed as daisyUI classes so it can change per breakpoint (e.g. up on phones)
    it('applies an extra className, including placement classes', () => {
        const { container } = render(
            <Dropdown title="t" options={[]} onSelect={vi.fn()} className="w-40 d-dropdown-top xl:d-dropdown-bottom" />,
        );
        expect(container.firstChild).toHaveClass('d-dropdown', 'w-40', 'd-dropdown-top', 'xl:d-dropdown-bottom');
    });

    // a title with breakpoint variants contains every variant's text; label keeps one name
    it('uses label as the accessible name when the title is not plain text', () => {
        render(
            <Dropdown
                title={
                    <>
                        <span>Short</span>
                        <span>Long title</span>
                    </>
                }
                label="Long title"
                options={[]}
                onSelect={vi.fn()}
            />,
        );
        expect(screen.getByRole('button', { name: 'Long title' })).toBeInTheDocument();
    });

    it('wraps the title so a long one truncates instead of wrapping', () => {
        render(<Dropdown title="A very long option name" options={[]} onSelect={vi.fn()} />);
        expect(screen.getByText('A very long option name')).toHaveClass('truncate');
    });

    describe('sections', () => {
        const SECTIONS = [
            { title: 'First', options: ['a', 'b'] },
            { title: 'Second', options: ['c'] },
        ];
        const details = () => [...document.querySelectorAll('details')];

        it('renders each section as a collapsible group holding its options', () => {
            render(<Dropdown title="t" sections={SECTIONS} onSelect={vi.fn()} />);
            expect(details().map((d) => d.querySelector('summary')!.textContent)).toEqual(['First', 'Second']);
            const items = within(details()[0]).getAllByRole('listitem', { hidden: true });
            expect(items.map((li) => li.textContent)).toEqual(['a', 'b']);
        });

        // daisyUI only styles <li><details>, and a <ul> may only hold <li>s
        it('puts each section in a list item of the menu', () => {
            render(<Dropdown title="t" sections={SECTIONS} onSelect={vi.fn()} />);
            for (const d of details()) expect(d.parentElement!.tagName).toBe('LI');
        });

        it('starts with only the first section open', () => {
            render(<Dropdown title="t" sections={SECTIONS} onSelect={vi.fn()} />);
            expect(details().map((d) => d.open)).toEqual([true, false]);
        });

        // the shared name is what makes the browser close the others
        it('names the sections alike, and differently from another dropdown', () => {
            render(
                <>
                    <Dropdown title="t" sections={SECTIONS} onSelect={vi.fn()} />
                    <Dropdown title="u" sections={SECTIONS} onSelect={vi.fn()} />
                </>,
            );
            const [one, two, other] = details().map((d) => d.getAttribute('name'));
            expect(one).toBeTruthy();
            expect(two).toBe(one);
            expect(other).not.toBe(one);
        });

        it('calls onSelect with the clicked option', async () => {
            const onSelect = vi.fn();
            render(<Dropdown title="t" sections={SECTIONS} onSelect={onSelect} />);
            await userEvent.click(screen.getByText('b'));
            expect(onSelect).toHaveBeenCalledWith('b');
        });

        it('does not select anything when a section header is clicked', async () => {
            const onSelect = vi.fn();
            render(<Dropdown title="t" sections={SECTIONS} onSelect={onSelect} />);
            await userEvent.click(screen.getByText('Second'));
            expect(onSelect).not.toHaveBeenCalled();
        });
    });

    // compile-time: tsc fails here (in `npm run build`) if the props stop being one or the other
    it('takes options or sections, not both or neither', () => {
        // @ts-expect-error neither
        render(<Dropdown title="neither" onSelect={vi.fn()} />);
        // @ts-expect-error both
        render(<Dropdown title="both" options={['a']} sections={[]} onSelect={vi.fn()} />);
    });

    describe('menu gap', () => {
        const menu = () => screen.getByRole('list');

        it('sits below the trigger by default', () => {
            render(<Dropdown title="t" options={['a']} onSelect={vi.fn()} />);
            expect(menu()).toHaveClass('mt-2');
        });

        it('follows menuClassName, for menus that open upward', () => {
            render(<Dropdown title="t" options={['a']} onSelect={vi.fn()} menuClassName="mb-2" />);
            expect(menu()).toHaveClass('mb-2');
            expect(menu()).not.toHaveClass('mt-2');
        });
    });
});
