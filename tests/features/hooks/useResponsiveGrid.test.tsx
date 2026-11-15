import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { render } from '@testing-library/react';
import { useResponsiveGrid } from '@/features/hooks/useResponsiveGrid';
import { useGridStore } from '@/features/store';
import { CellKind } from '@/types/grid';
import { fitCellSize, pickGridLayout } from '@/utils/layout';
import { installFakeResizeObserver } from '../../helpers/resize';

const api = () => useGridStore.getState();

const LAPTOP = { width: 1000, height: 700 };
const PHONE = { width: 360, height: 600 };

// jsdom lays nothing out, so every element would measure 0x0 on mount
const measureBoxAs = (box: { width: number; height: number }) =>
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(box as DOMRect);

function Box() {
    const ref = useRef<HTMLDivElement>(null);
    useResponsiveGrid(ref);
    return <div ref={ref} />;
}

function Unattached() {
    const ref = useRef<HTMLDivElement>(null);
    useResponsiveGrid(ref);
    return null;
}

describe('useResponsiveGrid', () => {
    let observers: ReturnType<typeof installFakeResizeObserver>;

    beforeEach(() => {
        observers = installFakeResizeObserver();
    });

    it('applies the layout picked for the box on mount', () => {
        measureBoxAs(LAPTOP);
        render(<Box />);
        expect(api()).toMatchObject(pickGridLayout(LAPTOP.width, LAPTOP.height));
    });

    it('gives an unmeasured 0x0 box a usable grid', () => {
        measureBoxAs({ width: 0, height: 0 });
        render(<Box />);
        expect(api()).toMatchObject(pickGridLayout(0, 0));
    });

    it('rescales only the cells on resize: dimensions and walls are kept', () => {
        measureBoxAs(LAPTOP);
        render(<Box />);
        const { rows, cols, cellSize } = api();
        api().setWall(0, 0);

        observers.resize(PHONE.width, PHONE.height);

        const expected = fitCellSize(PHONE.width, PHONE.height, rows, cols);
        expect(expected).not.toBe(cellSize); // guard: the two boxes must give different cell sizes
        expect(api()).toMatchObject({ rows, cols, cellSize: expected });
        expect(api().at(0, 0)).toBe(CellKind.wall);
    });

    // ResizeObserver fires once as soon as it starts observing, with the box measured on mount
    it('changes nothing when the first callback reports the box measured on mount', () => {
        measureBoxAs(LAPTOP);
        render(<Box />);
        const version = api().gridVersion;

        observers.resize(LAPTOP.width, LAPTOP.height);
        expect(api().gridVersion).toBe(version);
    });

    it('stops observing on unmount', () => {
        measureBoxAs(LAPTOP);
        const { unmount } = render(<Box />);
        expect(observers.live()).toBe(1);
        unmount();
        expect(observers.live()).toBe(0);
    });

    it('leaves exactly one live observer under Strict Mode', () => {
        measureBoxAs(LAPTOP);
        render(<Box />, { reactStrictMode: true });
        expect(observers.live()).toBe(1);
    });

    it('does nothing until the ref is attached to an element', () => {
        const before = api();
        render(<Unattached />);
        expect(api()).toBe(before);
        expect(observers.live()).toBe(0);
    });
});
