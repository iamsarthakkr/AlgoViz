// Authored by - Sarthak Kumar
//
// AlgoPickers: the algorithm and maze dropdowns. Receives the algorithm controller and maze
// generator owned by ui/Grid.tsx.
// - Picking an algorithm only writes the selection to useSettingsStore; the controller picks it up
//   the next time a run starts, so a run in progress is left alone
// - The maze dropdown is an action menu, not a selection: picking a maze generates it right away.
//   Picking a maze clears the current path first, so the old path never shows under the new maze

import { Dropdown } from '@/components/Dropdown';
import { algoLabels } from '@/features/algo';
import { AlgoController, MazeGeneratorApi } from '@/features/animations';
import { mazeSections } from '@/features/mazes';
import { useSettingsStore } from '@/features/store';

type Props = {
    algo: AlgoController;
    maze: MazeGeneratorApi;
};

export const AlgoPickers = ({ algo, maze }: Props) => {
    const algoKey = useSettingsStore((s) => s.algoKey);

    const onAlgoChange = (k: string) => {
        const api = useSettingsStore.getState();
        api.setAlgoKey(k);
    };

    const onGenerateMaze = (key: string) => {
        algo.clear();
        maze.generate(key);
    };

    return (
        <>
            <Dropdown
                title={algoKey}
                options={algoLabels}
                onSelect={onAlgoChange}
                className="flex-1 min-w-0 xl:flex-none xl:w-50 font-semibold"
            />
            <Dropdown
                title={
                    <>
                        <span className="xl:hidden">Mazes</span>
                        <span className="hidden xl:inline">Mazes & Patterns</span>
                    </>
                }
                label="Mazes & Patterns"
                sections={mazeSections}
                onSelect={onGenerateMaze}
                className="flex-1 min-w-0 xl:flex-none xl:w-50 font-semibold d-dropdown-end xl:d-dropdown-start"
            />
        </>
    );
};
