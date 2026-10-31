// Authored by - Sarthak Kumar
//
// Stats: the active run's algorithm, status, visited count, path length (in steps, i.e. path cells
// minus one; "No path" when the run finished without reaching the goal) and path cost, plus a note on
// what the selected algorithm guarantees (in red when, on this grid, its path may not be the cheapest).
// - The note has a fixed two-line height on phones, whatever its text: picking another algorithm
//   mid-run must not change the row's height (see below)
// - Pure: Grid.tsx passes the controller's values as props
// - Every item renders in every state, with "-" placeholders: on phones this panel is an `auto` grid
//   row, so items appearing mid-run would change its height, resize the grid and stop the run
// - Only the status is aria-live; the visited count changes every frame and would flood a screen reader

import { AlgoEntry, AlgoStatus } from '@/types/algo';

type Props = {
    algo: string;
    selectedAlgo: string;
    status: AlgoStatus | undefined;
    visited: number;
    pathLen: number | undefined;
    pathCost: number | undefined;
    shortest: AlgoEntry['shortest'] | null;
    gridHasWeights: boolean;
    className?: string;
};

const StatusLabels: Record<AlgoStatus, string> = {
    [AlgoStatus.initial]: 'Ready',
    [AlgoStatus.running]: 'Running',
    [AlgoStatus.paused]: 'Paused',
    [AlgoStatus.done]: 'Finished',
};

const AlgoDescription: Record<AlgoEntry['shortest'], string> = {
    always: '%s always finds the cheapest path',
    'unweighted-only': '%s ignores weights, so its path may not be the cheapest',
    never: '%s finds a path, not necessarily the shortest',
};

export const Stats = ({
    algo,
    selectedAlgo,
    status,
    visited,
    pathLen,
    pathCost,
    shortest,
    gridHasWeights,
    className = '',
}: Props) => {
    const noPath = status === AlgoStatus.done && pathLen === 0;
    const note = shortest ? AlgoDescription[shortest].replace('%s', selectedAlgo) : '';
    // red only when the warning applies to this grid: ignoring weights is harmless without any
    const warn = shortest === 'never' || (shortest === 'unweighted-only' && gridHasWeights);
    const noteColor = warn ? 'text-red-700' : 'opacity-70';
    return (
        <aside aria-label="Stats" className={`${className} flex xl:flex-col items-center justify-center`}>
            <section className="w-full">
                <h2 className="hidden xl:block xl:text-lg font-semibold mb-2">Stats</h2>
                <dl className="grid grid-cols-4 gap-2 text-center w-full xl:grid-cols-1 xl:text-left">
                    <div className="hidden xl:block min-w-0">
                        <dt className="text-xs opacity-70">Algo</dt>
                        <dd className="text-sm xl:text-base font-semibold xl:whitespace-normal truncate">
                            {algo || '-'}
                        </dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs opacity-70">Status</dt>
                        <dd
                            className="text-sm xl:text-base font-semibold xl:whitespace-normal truncate"
                            aria-live="polite"
                        >
                            {status === undefined ? '-' : StatusLabels[status]}
                        </dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs opacity-70">Visited</dt>
                        <dd className="text-sm xl:text-base font-semibold tabular-nums truncate">{visited}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs opacity-70">Path</dt>
                        <dd className="text-sm xl:text-base font-semibold tabular-nums truncate">
                            {pathLen === undefined ? '-' : noPath ? 'No path' : pathLen - 1}
                        </dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs opacity-70">Cost</dt>
                        <dd className="text-sm xl:text-base font-semibold tabular-nums truncate">
                            {pathCost === undefined || noPath ? '-' : pathCost}
                        </dd>
                    </div>
                </dl>
                <p
                    title={note}
                    className={`${noteColor} mt-2 h-8 line-clamp-2 text-center text-xs xl:mt-4 xl:h-auto xl:line-clamp-none xl:text-left`}
                >
                    {note}
                </p>
            </section>
        </aside>
    );
};
