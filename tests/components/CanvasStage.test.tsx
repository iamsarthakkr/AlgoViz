import { afterEach, describe, expect, it } from 'vitest';
import { createRef } from 'react';
import { render } from '@testing-library/react';
import { CanvasStage, CanvasStageHandle } from '@/components/CanvasStage';

describe('CanvasStage', () => {
    const originalDpr = window.devicePixelRatio;
    afterEach(() => {
        window.devicePixelRatio = originalDpr;
    });

    it('stacks a base and a click-through overlay canvas of the grid size', () => {
        const { container } = render(<CanvasStage rows={3} cols={4} cellSize={10} />);
        const [base, overlay] = container.querySelectorAll('canvas');
        expect(base.style.width).toBe('40px');
        expect(base.style.height).toBe('30px');
        expect(overlay.style.pointerEvents).toBe('none');
    });

    // blending, not covering, is what keeps weights, grid lines and markers visible through a run
    it('blends the overlay with the base', () => {
        const { container } = render(<CanvasStage rows={3} cols={4} cellSize={10} />);
        const [base, overlay] = container.querySelectorAll('canvas');
        expect(overlay.style.mixBlendMode).toBe('multiply');
        expect(base.style.mixBlendMode).toBeFalsy();
    });

    it('scales the backing store by devicePixelRatio and draws in logical pixels', () => {
        window.devicePixelRatio = 2;
        const ref = createRef<CanvasStageHandle>();
        const { container } = render(<CanvasStage ref={ref} rows={3} cols={4} cellSize={10} />);
        const base = container.querySelector('canvas')!;
        expect(base.width).toBe(80);
        expect(base.height).toBe(60);
        expect(ref.current!.getBaseCtx()!.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    });

    it('exposes two distinct 2D contexts', () => {
        const ref = createRef<CanvasStageHandle>();
        render(<CanvasStage ref={ref} rows={2} cols={2} cellSize={10} />);
        const base = ref.current!.getBaseCtx();
        const overlay = ref.current!.getOverlayCtx();
        expect(base).not.toBeNull();
        expect(overlay).not.toBeNull();
        expect(base).not.toBe(overlay);
    });

    it('resizes when the grid dimensions change', () => {
        const { container, rerender } = render(<CanvasStage rows={2} cols={2} cellSize={10} />);
        rerender(<CanvasStage rows={5} cols={6} cellSize={10} />);
        expect(container.querySelector('canvas')!.style.width).toBe('60px');
    });
});
