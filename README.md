# AlgoViz

A pathfinding visualizer. Paint walls and terrain on a grid, place the start and goal, pick an
algorithm, and watch it explore cell by cell until it traces its path. Six algorithms, ten
maze and terrain generators, weighted cells, and step-by-step playback, all on `<canvas>` and
entirely client-side.

**Live:** [viz.imsarthakkr.tech](https://viz.imsarthakkr.tech/)

## Features

- **Six algorithms:** BFS, DFS, Bidirectional BFS, Dijkstra's, A\* and Greedy best-first.
- **Weighted cells:** three terrain levels (×2, ×5, ×10). Dijkstra's and A\* find the cheapest
  path; the others ignore weights but still report what their path really costs, so you can compare.
- **Mazes and terrain:** Recursive Division (plus two skewed variants), Prim's, randomized DFS,
  random walls; Terrain Blobs, Random Weights and Add Loops, which layer on top of any maze; a
  one-click Weighted Maze; and Clear Walls / Weights / Board.
- **Playback:** Visualize, Pause, Step one event at a time, Clear, and a speed you can change mid-run.
  Edit the grid after a run finishes and the path is re-solved instantly.
- **Editing:** the legend doubles as the brush palette. Drag to paint, drag from a matching cell
  (or right-click / Alt) to erase, drag the markers to move them.
- **Live stats:** status, cells visited, path length, path cost, and what the selected algorithm
  guarantees.
- **Responsive:** phone to desktop, touch drawing, grid sized to the screen. A built-in guide opens
  on the first visit.

| Algorithm         | Reads weights | Path guarantee              | Frontier                   |
| ----------------- | ------------- | --------------------------- | -------------------------- |
| BFS               | No            | Shortest on unweighted grid | Ring-buffer queue          |
| DFS               | No            | None                        | Stack                      |
| Bidirectional BFS | No            | Shortest on unweighted grid | Two queues, meet in middle |
| Dijkstra's        | Yes           | Cheapest                    | Binary min-heap on `g`     |
| A\*               | Yes           | Cheapest                    | Min-heap on `g + h`        |
| Greedy best-first | No            | None                        | Min-heap on `h`            |

## How it works

### Algorithms are generators

Every algorithm and maze generator is a plain generator function that **yields one small event
per unit of work** instead of returning a finished answer:

```ts
type AlgoEvent =
    | { type: 'enqueue'; at: Coord }
    | { type: 'visit'; at: Coord }
    | { type: 'path'; nodes: Coord[]; visited: number; cost: number };

type PathFinder = (grid: GridSnapShot) => Generator<AlgoEvent, void, void>;
```

One generic **runner** pulls events on a `requestAnimationFrame` loop at a set events-per-second
rate. Play, pause, step, skip-to-end and live speed changes are all runner controls, so no
algorithm contains any playback code. The generator keeps its own position, so pausing and
resuming is just not pulling for a while.

```
 snapshot ──► generator ──► runner (rAF, N events/frame) ──► onEvent
 of the grid   (bfs, A*,      play / pause / step /            ├─ algorithm: paint one cell on the overlay canvas
               prims, …)      skipToEnd / setSpeed             └─ maze: one call into the grid store
```

### Two canvases, two render paths

The grid is two stacked canvases. The **base** layer (walls, weights, markers) redraws from the
Zustand grid store when the grid changes. The **overlay** (frontier, visited, path) is painted
directly by the runner's event callback, with no React render per event. React batches the
stats updates into one commit per frame. The overlay uses `mix-blend-mode: multiply`, so terrain
stays visible underneath a run.

### Invalidation by version

The grid store bumps a `gridVersion` on every real edit. The controller tags the active run with
the version it was built from. When they differ, it rebuilds the run from a fresh snapshot, and
if the old run had finished, it skips the new one to the end. That one mechanism is what makes a
finished path follow your edits live.

### One file per algorithm

An algorithm is one generator file plus one registry entry (`label`, `run`, `weighted`,
`shortest`, `description`). The dropdown, the info dialog, the stats note and the test suite are
all derived from the registry. Mazes work the same way.

## Design decisions

- **Generators, not precomputed step lists.** A recorded list of steps would make Step and Pause
  just as easy, but it would compute the whole search up front and hold every step in memory.
  A generator does the work lazily, so a run you clear halfway never finishes its search.
- **Canvas, not DOM cells.** The largest grid, 51×41, is over 2,000 cells, each repainted many times per run.
  Canvas makes a cell update one `fillRect`, and keeps React out of the hot path.
- **Flat arrays everywhere.** Cells and weights are flat arrays indexed `r * cols + c`, and the
  algorithms use typed arrays (`Uint8Array`, `Int32Array`) for `seen`, `dist` and `parent`.
- **Weights are a parallel array, not a cell kind.** "Can I enter?" and "what does it cost?" are
  separate questions, so wall checks never changed when weights arrived.
- **A\* breaks ties toward the goal.** On an open board most cells tie on `f`. Preferring the
  smaller `h` keeps the search on a line: a 41-cell path visits 41 cells instead of 148.
- **One copy of every piece of state.** Selections live only in the settings store, a run's
  status comes only from its runner, and the active run lives only in the controller.

More in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Testing

Over 750 tests with Vitest and Testing Library, in `tests/` mirroring `src/`.

- **Contract suites** run over every registered algorithm and maze: valid paths, true costs,
  "`shortest: 'always'` means it matches a reference cheapest path on random weighted grids",
  and per-group rules for mazes. A new entry is tested by being registered.
- **Reproducible randomness:** a seeded `Math.random`, so a failing maze or grid can be replayed.
- **Deterministic animation:** a fake `requestAnimationFrame` steps the runner frame by frame.
- **Coverage gate:** CI fails below 95% statements and lines, or 90% branches.

## Getting started

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check, then static build into dist/
npm run preview        # serve the build locally
npm run lint
npm test               # watch mode; npm run test:run for a single run
npm run test:coverage  # single run with the coverage gate
```

**Stack:** Vite 8 · React 19 · TypeScript (strict) · Zustand 5 · Tailwind CSS 4 + daisyUI 5 ·
Vitest

## Project structure

```
src/
  features/
    algo/          pathfinding generators + registry
    mazes/         maze and terrain generators + registry
    animations/    the runner, useAlgoController, useMazeGenerator
    CanvasGrid/    the interactive canvas and pointer handling
    painters/      pure canvas drawing (base scene, overlay events, palette)
    store/         Zustand stores: grid data, user settings
    Toolbar/       algorithm/maze pickers, playback controls
  lib/data-structures/  ring-buffer queue, binary min-heap
  ui/              page layout, stats, legend, info dialog
  utils/           coordinates, grid sizing, constants
tests/             mirrors src/
```

## Deployment

A static build served by unprivileged nginx in Docker, behind Caddy on a VPS. CI runs lint,
tests with coverage, the build and a smoke test against the image; tagged releases publish to
GHCR and the VPS only pulls. See [DEPLOY.md](./DEPLOY.md).

## Docs

- [ARCHITECTURE.md](./ARCHITECTURE.md): state, rendering, the runner and the controllers in depth
- [FEATURES.md](./FEATURES.md): what the app does, feature by feature
- [DEPLOY.md](./DEPLOY.md): CI, releases and production deployment
- [CLAUDE.md](./CLAUDE.md): conventions for working in the codebase
