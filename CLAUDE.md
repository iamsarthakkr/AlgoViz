# AlgoViz — Project Context

> This file is the entry point for working in this codebase. For deeper detail see
> [ARCHITECTURE.md](./ARCHITECTURE.md) (state/render/animation internals) and
> [FEATURES.md](./FEATURES.md) (what the app does, feature by feature).

## What this project is

AlgoViz is a pathfinding-algorithm visualizer. The user paints walls on a grid, places a
start/goal marker, picks an algorithm (BFS, DFS, Bidirectional BFS, Dijkstra's, A\*) and/or a
maze generator (Recursive Division, Prim's, randomized DFS flood-fill, random walls, terrain), and
watches the algorithm explore the grid cell-by-cell in an animated overlay, ending with the
traced path. Cells can be weighted: Dijkstra's and A\* find the cheapest path, and the others report what
theirs really costs.

It's a static single-page canvas app (Vite, no router — one view at `/`), one Zustand store for grid data,
one for UI/settings, and a generator-based "algorithm as a sequence of yielded events"
pattern that both pathfinding algorithms and maze generators share.

## Tech stack

- **Vite 8** (static SPA build, `@vitejs/plugin-react-swc`), **React 19**
- **TypeScript**, strict mode
- **Zustand 5** for state (two stores, no middleware/persistence)
- **Tailwind CSS 4** + **daisyUI 5** (`d-` prefixed classes, **light theme only**) for chrome (toolbar, dropdown, modal); the grid itself is drawn on `<canvas>`, not DOM
- **Prettier** + ESLint (flat config: `typescript-eslint` + `react-hooks` + `react-refresh`)
- One path alias (`vite.config.ts` + `tsconfig.app.json`): `@/*` → `src/*` — import as `@/features/...`, `@/ui/...`

Tests: **Vitest** + Testing Library (jsdom), in `tests/` — see "Tests" below. No backend/API/database — everything is client-side and in-memory (a refresh resets the grid). The one thing persisted is whether the info dialog has been seen (`localStorage`, see `useInfoModal`).

## Running it

```bash
npm install
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # tsc -b type-check, then vite build → dist/
npm run preview   # serve dist/ locally
npm run lint
npm test                # vitest watch mode
npm run test:run        # single run
npm run test:coverage   # single run + coverage report (fails under the thresholds in vite.config.ts)
```

`npm run build` emits a fully static bundle in `dist/` that any static file host can serve.
Deployment is Docker: `Dockerfile` (build → unprivileged nginx on 8080), `nginx.conf` (CSP,
caching, `/healthz`), `compose.yaml` (runs the released GHCR image by `APP_VERSION` — nothing is built on the VPS; loopback-only port for Caddy). CI in `.github/workflows/`
runs lint, `test:coverage`, build and `scripts/smoke-test.sh` against the built image.
If you add an external origin (CDN, analytics, fonts), update the CSP in `nginx.conf` too. Details in [DEPLOY.md](./DEPLOY.md).

## Directory map

```
index.html             HTML shell: title/meta, mounts src/main.tsx
src/
  main.tsx             Entry: fonts, index.css, renders <App /> in StrictMode
  App.tsx              Root component (just renders ui/Grid)
  index.css            Tailwind + daisyUI setup, theme tokens, the .page grid layout (areas per breakpoint)
  ui/Grid.tsx           Top-level page: owns the algo controller + maze generator + info dialog state; places every piece in the .page grid layout
  ui/Legend.tsx, Stats.tsx  Side panels: legend (swatches drawn by the painters), stats of the active run
  ui/InfoModal.tsx      The "About AlgoViz" carousel (what it is, how to use, algorithms, about) inside components/Modal
  components/           Generic, feature-agnostic UI (CanvasStage + its hook, Dropdown, Modal); content comes in as props/children
  icons/                Small SVG icon components (Info, Close, Chevron): aria-hidden, drawn in currentColor
  features/
    store/               Zustand stores: useGridStore (grid data), useSettingsStore (UI state)
    CanvasGrid/          The interactive canvas: pointer handling, base-layer draw scheduling
    painters/            Pure canvas-drawing functions (base scene, overlay/algo events, palette)
    algo/                Pathfinding algorithms as generator functions (bfs, dfs, dijkstra, astar, ...)
    mazes/               Maze/pattern generators as generator functions (prims, recursiveDivision, ...)
    animations/          The generator "runner" (rAF playback engine) + hooks that drive algo/maze runs
    Toolbar/             AlgoPickers (algorithm/maze dropdowns), PlaybackControls (play/pause/step/clear, speed)
    hooks/               useRaf (coalesce into one rAF callback), useResponsiveGrid (sizes the grid to its box),
                         useInfoModal (info dialog open state + first-visit flag in localStorage)
  store/                 Plain (non-Zustand) data structures: ring-buffer Queue, binary min-heap
  types/                 Shared TypeScript types (grid, algo, mazeGenerator, settings, common)
  utils/                 Small pure helpers (grid init/snap, grid sizing in layout.ts, clamp, speed presets, constants)
tests/                   Mirrors src/ one-to-one (src/features/algo/bfs.ts → tests/features/algo/bfs.test.ts)
  setup.ts               jest-dom, recording canvas ctx per canvas (a width/height change records a clear),
                         no-op ResizeObserver, resets both Zustand stores before each test
  helpers/               ASCII grid parser + path/maze checkers, seeded Math.random, fake rAF, recording canvas ctx,
                         fake ResizeObserver (resize.ts), fake algo controller / maze generator (controllers.ts)
```

Note: there are **two unrelated things called "store"** in this repo — `src/store/` (data
structures: `Queue`, `min_priority_queue`) and `src/features/store/` (Zustand app state). Don't
confuse them when navigating.

## Tests

- Test files live in `tests/`, mirroring the `src/` layout; import source through `@/`.
- `tests/features/algo/index.test.ts` and `tests/features/mazes/index.test.ts` are **contract
  suites** run over the whole registry — a newly registered algorithm or maze is tested
  automatically. Add a per-file test only for behaviour specific to that algorithm.
- Randomness: use `seedRandom(seed)` / `fixRandom(value)` from `tests/helpers/random.ts`, never
  real `Math.random`, so failures are reproducible.
- Animation: `installFakeRaf()` from `tests/helpers/raf.ts` replaces `requestAnimationFrame`;
  advance with `frame()` / `flush()` (wrap in `act()` when React state updates).
- Known bugs are pinned with `it.fails(...)` plus a `BUG:` comment explaining the bug and the fix. When
  you fix one, the `it.fails` starts failing — flip it to `it`.

## Core architectural idea

Both pathfinding algorithms and maze generators are plain **JS generator functions** that
`yield` small event objects describing one step of work (`{type:'visit', at}`,
`{type:'carve', at}`, etc.) instead of returning a finished result. A generic **runner**
(`features/animations/runner.ts`) pulls events out of the generator on a
`requestAnimationFrame` loop at a configurable events-per-second rate, and a callback paints
each event onto canvas (algorithms) or writes it into the grid store (mazes). This is what
makes play/pause/step/skip-to-end and speed control "free" — they're all just runner
controls, not algorithm-specific code. See ARCHITECTURE.md for the full flow.

Adding a new algorithm or maze generator is meant to be "write one generator file, register
it". The contract suites in `tests/` check a new entry automatically; the remaining friction is
the per-file `id`/`inb`/`isWall` helpers.

## Conventions actually used in this codebase

- Algorithms register as **one entry** in `features/algo/registry.ts` (`algoRegistry`: label, `run`,
  `weighted`, `shortest`, `description`); `algoLabels` and `algorithmMap` are derived from it, and
  array order is the dropdown order. A new entry also needs its flags added to the metadata test
  in `tests/features/algo/index.test.ts`. Mazes work the same way: one entry in
  `features/mazes/registry.ts` (`mazeRegistry`: label, `run`, `group`), with `mazeMap` and the
  dropdown's `mazeSections` derived from it. The group sets what the contract demands, so a new
  entry also needs its group added to the test in `tests/features/mazes/index.test.ts`.
- Every generator states what it resets, and the hook maps each event to one store call: a wall maze
  yields `fill-wall`, or `clear-wall` plus `clear-weights`; a terrain entry leaves walls alone.
  A generator that reads the board calls `getCells()` when it starts, and `sequence(...)` starts each
  generator only after the one before has finished, so it sees what that one built.
- Grid coordinates are `{r, c}` (`Coord`), flattened to a 1D index via `r * cols + c`
  everywhere (grid store, algorithms, mazes, painters) — there is no 2D array anywhere.
- `weights` is a flat array parallel to `cells`: the cost to enter each cell. Walls stay in `cells`
  (can I enter?), so wall checks don't change. Only plain cells carry weight, and marker cells never
  count (`getGridSnapshot` normalises them). Take values from `WEIGHT_LEVELS`: the painter only
  knows those, so another value would count but draw as a plain cell.
- Store mutators return whether they changed anything. Call `refresh()` only on `true`: a
  `gridVersion` bump re-solves a finished run.
- Two canvases are stacked per grid: a **base** layer (cells/walls/markers, redrawn on grid
  state changes) and an **overlay** layer (frontier/visited/path, painted directly and
  imperatively by the runner's event callback, bypassing React re-renders for performance).
- `gridLock` (in `useGridStore`) is the mechanism that disables pointer editing while an
  algorithm or maze generator is running.
- One copy of every piece of state. The user's **selections** (algorithm, speed, draw tool) live only in
  `useSettingsStore`: the dropdowns write there and `useAlgoController` reads from there, never
  keeping its own copy. A run's **status** comes only from the runner (`onStatusChange`);
  controls never set it. Details in ARCHITECTURE.md §2 and §7.
- Component/hook pairs follow a `Thing.tsx` + `useThing.ts` split with a barrel `index.ts`
  re-exporting the public surface (see `CanvasGrid/`).
- Responsive styles are mobile-first with **one desktop breakpoint, `xl:`** (1280px), matching
  `@variant xl` in the `.page` layout. Render each piece once and place it by grid area; never
  render a copy per breakpoint. Nothing next to the grid may change size during a run (panels
  are `clamp()`ed, controls have fixed `xl:` widths): a size change resizes the grid and stops
  the run. Details in ARCHITECTURE.md §1 "Page layout".
