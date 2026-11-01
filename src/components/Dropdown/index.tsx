// Authored by - Sarthak Kumar
//
// Dropdown: generic daisyUI-styled select menu (title + flat options or collapsible sections -> onSelect).
// Feature-agnostic — used for algorithm, maze, and speed selection in the toolbar.

import { Callback1 } from '@/types/common';
import { useCallback, useId } from 'react';
import { ChevronIcon } from '@/icons/ChevronIcon';

type Section = { title: string; options: readonly string[] };

type Props = {
    title: React.ReactNode;
    label?: string; // accessible name; needed when the title isn't plain text (e.g. a short form for phones)
    onSelect: Callback1<string>;
    className?: string; // root: width, and daisyUI placement (d-dropdown-top/-end, responsive variants work)
    menuClassName?: string; // the gap between trigger and menu, on the side the menu opens (default mt-2)
} & ({ options: readonly string[]; sections?: never } | { sections: readonly Section[]; options?: never });

export const Dropdown = (props: Props) => {
    const { title, label, options, sections, onSelect, className = '', menuClassName = 'mt-2' } = props;
    const accordionName = useId();

    const selectItem = useCallback(
        (item: string) => {
            onSelect(item);

            const element = document.activeElement;
            if (element && element instanceof HTMLElement)
                setTimeout(() => {
                    element.blur();
                }, 10);
        },
        [onSelect],
    );

    const listItem = (key: string) => (
        <li
            className="py-0 bg-primary text-xs rounded-box hover:bg-primary/80"
            key={key}
            onClick={() => selectItem(key)}
        >
            <a className="active:bg-primary/90">{key}</a>
        </li>
    );

    return (
        <div className={`d-dropdown ${className}`}>
            <div
                tabIndex={0}
                role="button"
                aria-label={label ?? (typeof title === 'string' ? title : undefined)}
                className="w-full min-w-0 px-3 py-2 cursor-pointer border-none outline-none rounded-md bg-primary text-white flex items-center justify-center text-sm hover:text-secondary"
            >
                <span className="truncate">{title}</span>
                <ChevronIcon dir="down" className="size-4 ms-1.5 -me-1.5 shrink-0" />
            </div>
            <ul
                tabIndex={0}
                className={`d-dropdown-content d-menu ${menuClassName} py-3 bg-primary text-white rounded-box z-1 w-40 p-2 shadow-sm text-xs max-h-[60vh] overflow-y-auto flex-nowrap`}
            >
                {options?.map((key) => listItem(key))}
                {sections?.map((section, i) => (
                    <li key={section.title}>
                        {/* a shared name makes these an accordion, so the menu stays short on phones */}
                        <details name={accordionName} open={i === 0}>
                            <summary className="text-xs font-semibold text-white/70 hover:bg-primary/80 hover:text-white">
                                {section.title}
                            </summary>
                            <ul className="ms-1 ps-1 whitespace-normal">
                                {section.options.map((key) => listItem(key))}
                            </ul>
                        </details>
                    </li>
                ))}
            </ul>
        </div>
    );
};
