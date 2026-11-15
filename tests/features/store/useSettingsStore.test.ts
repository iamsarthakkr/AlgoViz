import { describe, expect, it } from 'vitest';
import { useSettingsStore } from '@/features/store';
import { algoLabels } from '@/features/algo';
import { WEIGHT_LEVELS } from '@/utils/constants';

const api = () => useSettingsStore.getState();

describe('useSettingsStore', () => {
    it('has sensible defaults', () => {
        expect(api()).toMatchObject({
            algoKey: algoLabels[0],
            speed: 'medium',
            tool: { type: 'wall' },
        });
    });

    it('stores the draw tool', () => {
        const tool = { type: 'weight', weight: WEIGHT_LEVELS[0] } as const;
        api().setTool(tool);
        expect(api().tool).toEqual(tool);
        api().setTool({ type: 'wall' });
        expect(api().tool).toEqual({ type: 'wall' });
    });

    it('stores the selected algorithm and speed', () => {
        api().setAlgoKey(algoLabels[1]);
        api().setSpeed('fast');
        expect(api()).toMatchObject({ algoKey: algoLabels[1], speed: 'fast' });
    });
});
