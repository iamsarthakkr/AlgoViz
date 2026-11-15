import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InfoModal } from '@/ui/InfoModal';
import { algoLabels } from '@/features/algo';

const button = (name: string | RegExp) => screen.getByRole('button', { name });
const dots = () => screen.getAllByRole('button', { name: /^Go to slide/ });
const slideTitle = () => screen.getByRole('heading', { level: 2 }).textContent;
const currentDot = () => dots().findIndex((d) => d.getAttribute('aria-current') === 'step');

describe('InfoModal', () => {
    const setup = (open = true) => ({ user: userEvent.setup(), ...render(<InfoModal open={open} />) });

    it('is a dialog named by the current slide title', () => {
        setup();
        expect(screen.getByRole('dialog', { name: slideTitle()! })).toBeInTheDocument();
    });

    it('starts on the first slide, with Previous disabled', () => {
        setup();
        expect(currentDot()).toBe(0);
        expect(button('Previous')).toBeDisabled();
        expect(button('Next')).toBeEnabled();
    });

    it('Next and Previous page through the slides, stopping at both ends', async () => {
        const { user } = setup();
        const titles = [slideTitle()];
        for (let i = 1; i < dots().length; i++) {
            await user.click(button('Next'));
            titles.push(slideTitle());
        }
        expect(new Set(titles).size).toBe(dots().length);
        expect(button('Next')).toBeDisabled();

        await user.click(button('Previous'));
        expect(slideTitle()).toBe(titles[titles.length - 2]);
    });

    it('a dot jumps straight to its slide', async () => {
        const { user } = setup();
        const lastDot = dots().length - 1;
        await user.click(dots()[lastDot]);
        expect(currentDot()).toBe(lastDot);
        expect(slideTitle()).toBe(dots()[lastDot].getAttribute('aria-label')!.split(': ')[1]);
    });

    it('arrow keys page through the slides', () => {
        setup();
        const carousel = screen.getByRole('region', { name: 'About AlgoViz' });
        fireEvent.keyDown(carousel, { key: 'ArrowRight' });
        expect(currentDot()).toBe(1);
        fireEvent.keyDown(carousel, { key: 'ArrowLeft' });
        fireEvent.keyDown(carousel, { key: 'ArrowLeft' }); // already first: stays
        expect(currentDot()).toBe(0);
    });

    it('opens on the first slide again after being closed', async () => {
        const { user, rerender } = setup();
        await user.click(button('Next'));
        rerender(<InfoModal open={false} />);
        rerender(<InfoModal open={true} />);
        expect(currentDot()).toBe(0);
    });

    it('explains drawing with the legend and erasing', async () => {
        const { user } = setup();
        await user.click(screen.getByRole('button', { name: /How to use it/ }));
        const slide = screen.getByRole('group', { name: /of/ });
        expect(slide).toHaveTextContent(/pick Wall or a weight in the legend/);
        expect(slide).toHaveTextContent(/matches your tool/);
    });

    // names come from the registry; a new algorithm without a description would show a blank line
    it('describes every registered algorithm', async () => {
        const { user } = setup();
        await user.click(screen.getByRole('button', { name: /The algorithms/ }));
        for (const label of algoLabels) {
            const name = screen.getByText(label, { selector: 'dt' });
            expect(name.nextElementSibling!.textContent!.trim()).not.toBe('');
        }
    });

    // a new tab must not get window.opener access back to this page
    it('links to the source in a new tab, safely', async () => {
        const { user } = setup();
        await user.click(dots()[dots().length - 1]);
        const link = screen.getByRole('link', { name: /GitHub/ });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
        expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    });
});
