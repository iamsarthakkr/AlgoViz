// Authored by - Sarthak Kumar
//
// InfoModal: the "About AlgoViz" dialog — a carousel of short slides (what it is, how to use it,
// the algorithms, about) inside the generic components/Modal.
// - Prev/next arrows on both sides, dots to jump to a slide, and ← / → keys
// - Every slide gets the same minimum height, so the box doesn't jump as you page through
// - Opens on the first slide every time
// - The algorithms slide renders the registry (label + description), so it can't go stale

import React from 'react';
import { Modal } from '@/components/Modal';
import { ChevronIcon } from '@/icons/ChevronIcon';
import { algoRegistry } from '@/features/algo';
import { lightPalette as palette } from '@/features/painters';
import { Callback } from '@/types/common';

const REPO_URL = 'https://github.com/iamsarthakkr/AlgoViz';

const StartMark = () => (
    <span aria-hidden="true" style={{ color: palette.start }}>
        ▶
    </span>
);
const GoalMark = () => (
    <span aria-hidden="true" style={{ color: palette.goal }}>
        ◉
    </span>
);

type Slide = { title: string; body: React.ReactNode };

const SLIDES: Slide[] = [
    {
        title: 'What is AlgoViz?',
        body: (
            <div className="space-y-3">
                <p>
                    AlgoViz shows how pathfinding algorithms explore a grid, one cell at a time, and the path each one
                    finds from start to goal.
                </p>
                <p>Draw walls or generate a maze, pick an algorithm, and watch it search.</p>
            </div>
        ),
    },
    {
        title: 'How to use it',
        body: (
            <ul className="space-y-2.5">
                <li>
                    <b>Draw:</b> pick Wall or a weight in the legend, then drag on the grid. Weighted cells cost more to
                    cross.
                </li>
                <li>
                    <b>Erase:</b> start a drag on a cell that matches your tool, or drag with right-click or Alt held.
                </li>
                <li>
                    <b>Move start / goal:</b> drag <StartMark /> or <GoalMark />.
                </li>
                <li>
                    <b>Run:</b> pick an algorithm and press <b>Visualize</b>. <b>Step</b> advances one move,{' '}
                    <b>Pause</b> stops, <b>Speed</b> changes the pace, <b>Clear</b> wipes the result.
                </li>
                <li>
                    <b>Mazes:</b> pick one from <b>Mazes &amp; Patterns</b> to fill the grid with walls.
                </li>
            </ul>
        ),
    },
    {
        title: 'The algorithms',
        body: (
            <dl className="space-y-2.5">
                {algoRegistry.map((entry) => (
                    <div key={entry.label}>
                        <dt className="font-semibold">{entry.label}</dt>
                        <dd className="opacity-80">{entry.description}</dd>
                    </div>
                ))}
            </dl>
        ),
    },
    {
        title: 'About',
        body: (
            <div className="space-y-3">
                <p>
                    Built by <b>Sarthak Kumar</b> with React, TypeScript and canvas. Algorithms are generators that
                    yield one step at a time, which is what makes pause, step and speed control possible.
                </p>
                <p>
                    <a
                        href={REPO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                    >
                        Source on GitHub
                    </a>
                </p>
            </div>
        ),
    },
];

const arrowBtn =
    'absolute top-1/2 -translate-y-1/2 size-9 rounded-full grid place-items-center bg-primary text-white shadow ' +
    'hover:brightness-110 disabled:opacity-25 disabled:cursor-not-allowed';

type Props = {
    open: boolean;
    onModalClosed?: Callback;
};

export const InfoModal = ({ open, onModalClosed }: Props) => {
    const [slide, setSlide] = React.useState(0);

    // Start from the first slide on every open. Done while rendering (React's "adjust state when a
    // prop changes" pattern) rather than on close, so the content doesn't jump while the box fades out.
    const [wasOpen, setWasOpen] = React.useState(open);
    if (open !== wasOpen) {
        setWasOpen(open);
        if (open) setSlide(0);
    }

    const last = SLIDES.length - 1;
    const prev = () => setSlide((s) => Math.max(0, s - 1));
    const next = () => setSlide((s) => Math.min(last, s + 1));

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
    };

    const { title, body } = SLIDES[slide];

    return (
        <Modal open={open} onModalClosed={onModalClosed} title={title} className="w-11/12 max-w-lg">
            <div role="region" aria-roledescription="carousel" aria-label="About AlgoViz" onKeyDown={onKeyDown}>
                <div
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${slide + 1} of ${SLIDES.length}`}
                    className="mt-4 min-h-64 px-10 text-sm leading-relaxed xl:text-base"
                >
                    {body}
                </div>

                <button aria-label="Previous" className={`${arrowBtn} left-2`} onClick={prev} disabled={slide === 0}>
                    <ChevronIcon dir="left" />
                </button>
                <button aria-label="Next" className={`${arrowBtn} right-2`} onClick={next} disabled={slide === last}>
                    <ChevronIcon dir="right" />
                </button>

                <div className="mt-6 flex justify-center gap-2">
                    {SLIDES.map((s, i) => (
                        <button
                            key={s.title}
                            aria-label={`Go to slide ${i + 1}: ${s.title}`}
                            aria-current={i === slide ? 'step' : undefined}
                            onClick={() => setSlide(i)}
                            className={`h-2 rounded-full transition-all ${i === slide ? 'w-6 bg-primary' : 'w-2 bg-primary/25 hover:bg-primary/50'}`}
                        />
                    ))}
                </div>
            </div>
        </Modal>
    );
};
