# Architecture

Deep dive into state management, component wiring, and the run → animate → render pipeline.
See [CLAUDE.md](./CLAUDE.md) for the high-level map and [FEATURES.md](./FEATURES.md) for
feature-level behavior.

## 1. Page composition

```
main.tsx → App.tsx
  └─ ui/Grid.tsx  .page   (owns: gridRef, useAlgoController, useMazeGenerator, useResponsiveGrid, useInfoModal)
       ├─ (no area)  ui/InfoModal → components/Modal <dialog>   (top layer; takes no layout space)
       ├─ [header]   Toolbar <header> (algo, maze, toggleModal)
       │               ├─ info button (InfoIcon) → toggleModal
       │               └─ AlgoPickers: Dropdown (algorithm), Dropdown (maze/pattern)
       ├─ [grid]     <main> (padded)
       │               └─ grid box (no padding; measured by useResponsiveGrid)
       │                    └─ CanvasGrid (forwardRef → CanvasGridHandle)
       │                         └─ CanvasStage (forwardRef → CanvasStageHandle)
       │                              ├─ <canvas> base   (useCanvasLayer)
       │                              └─ <canvas> overlay (useCanvasLayer)
       ├─ [stats]    ui/Stats <aside>    (active run: algorithm, status, visited, path steps)
       ├─ [legend]   ui/Legend <aside>   (swatches drawn by the grid's painters)
       └─ [controls] PlaybackControls (algo): Visualize, Pause/Step, Clear path, Dropdown (speed)
```

`[name]` is the CSS grid area each piece is placed in (see "Page layout" below).

`ui/Grid.tsx` is the nearest common parent of everything that drives or shows a run, so it owns
the **one** algorithm controller (`useAlgoController(gridRef, algorithmMap, …)`) and maze
generator and passes them down as props (`algo`, `maze`). There must be exactly one instance:
calling the hook in two components would create two independent controllers with separate
runners. Plain props rather than Context or a store: the tree is one or two levels deep, and
the controller is a hook bound to a component lifecycle (refs, effects, rAF), not plain data.

The `gridRef` (`useRef<CanvasGridHandle>`) goes only to `CanvasGrid` and to the controller,
which uses `gridRef.current.getOverlayCtx()` / `clearOverlay()` to paint the overlay directly.
The toolbar never touches the canvas; it only calls the controller's public API. Because the
controller arrives as a prop, the toolbar components are tested with a fake controller
(`tests/helpers/controllers.ts`).

Re-render cost: controller state (e.g. `visitedApprox`, updated on every visit event) lives in
`GridPage`, so a running algorithm re-renders the whole page. React batches every `setState`
inside one rAF callback, so that is **one commit per frame**, not one per event (profiled: about
200 commits for a fast BFS run, 0.1–2 ms each in dev mode). Children's effects
don't re-run (their deps are unchanged; the legend swatches rely on `getCtx` being stable) and
the overlay is painted imperatively, but keep anything expensive out of that render path (or
`memo` it).

### Page layout (`.page` in `index.css`)

The page is a CSS grid with named areas. Every piece is rendered **once**; only the area map
changes per breakpoint, so the same `PlaybackControls` sit in the bottom bar on a phone and in
the top bar on desktop. Rendering a piece once per breakpoint and hiding one copy would
duplicate every button (and break every test that finds a button by name).

```
below xl (phones, tablets, small laptops)      xl and up (≥ 1280px)
'header'                                        'header header controls controls'
'grid'      ← minmax(0, 1fr)                    'legend grid   grid     stats'
'stats'                                         columns: clamp(9rem,16vw,15rem) minmax(0,1fr) auto clamp(…)
'legend'
'controls'  ← bottom bar, thumb reach
```

- **One desktop breakpoint, `xl`.** It is the narrowest width where the one-row top bar (title,
  pickers, controls ≈ 1130px) fits. Components switch with the same `xl:` prefix (they are
  written mobile-first: unprefixed classes are the phone styles, `xl:` overrides for desktop).
- **`minmax(0, 1fr)` for the grid track, and `min-h-0 min-w-0` on its elements.** A plain `1fr`
  is never smaller than its content, so once the canvas is drawn the grid could never shrink.
- **Panels scale with the window** (`clamp(9rem, 16vw, 15rem)`), so the grid keeps most of the
  width. They are **never sized by their content**: stats change during a run, and a panel that
  changes size resizes the grid box, which `resize()` treats as a grid change and stops the run.
  The same applies to the phone `stats` row: it must keep one height for its whole lifetime.
- **The controls get their own `auto` column** (spanning it and the stats column), so the top
  bar doesn't depend on the panel width. This is only safe because every control has a fixed
  `xl:` width: swapping Step for Pause or changing the speed label never changes the column.
- **The measured grid box has no padding.** `<main>` carries the gutter; the box inside it is
  what `useResponsiveGrid` measures, and load (border box) and `ResizeObserver` (content box)
  must see the same size. It centres the canvas with `items-center-safe justify-center-safe`
  and `overflow-auto`, so a grid held at `MIN_CELL` scrolls instead of being clipped.
- **The info dialog takes no layout space.** It is a modal `<dialog>` (`showModal()`, so it sits
  in the browser's top layer), not a grid area, so opening it can't resize the grid or stop a run.
- **Theme: light only.** daisyUI is configured with `themes: light --default` in `index.css`.
  Its default would switch daisyUI's base colours with the OS dark mode while the app's own
  colours and the canvas palette stay light, giving dark text on a dark modal box.
- **Phone details:** the speed menu opens upward from the bottom bar (`d-dropdown-top
d-dropdown-end`, `xl:d-dropdown-bottom`); controls are at least 44px tall; long labels have a
  short phone form (`Clear`, `Mazes`) with an `aria-label`/`label` that keeps one accessible
  name at every width; the bottom bar pads for the iPhone home bar
  (`env(safe-area-inset-bottom)`, enabled by `viewport-fit=cover` in `index.html`).

## 2. State management

Two independent Zustand stores, no shared slice, no middleware (no persist/devtools).

### `useGridStore` (`features/store/useGridStore.ts`) — the grid's source of truth

```ts
type Grid = {
    gridVersion: number; // bumped on every structural edit; the invalidation signal
    rows;
    cols;
    cellSize: number;
    cells: CellKind[]; // flat array, index = r*cols+c, CellKind.empty | CellKind.wall
    weights: number[]; // parallel flat array: the cost to ENTER each cell, DEFAULT_WEIGHT = plain
    start;
    goal: Coord;
    gridLock: boolean; // true while an algorithm/maze run owns the grid
    markersHidden: boolean; // true while a maze generates; start/goal keep their coordinates
};
```

Plus derived helpers (`idx`, `inBounds`, `at`, `weightAt`) and mutators
(`setWall`, `clearWall`, `clearWalls`, `fillWalls`, `setWeight`, `clearWeight`, `clearWeights`,
`setStart`, `setGoal`, `hideMarkers`, `showMarkers`, `setGridLock`, `refresh`, `reset`,
`resize`).

Key behaviors baked into the mutators:

- Mutators return whether they changed anything and skip `set` when they didn't. `setWall` and
  `setWeight` refuse the start/goal cell. Callers `refresh()` only on `true`: a `gridVersion` bump
  re-solves a finished run, and `pointermove` fires many times per cell.
- `setStart`/`setGoal` **snap** to the nearest non-wall cell via a small BFS
  (`utils/grid.ts:nearestEmptyCell`) whenever the target cell would land on a wall, and
  refuse the move if it would collide with the other marker.
- `hideMarkers()` / `showMarkers()` hide start/goal while a maze generates. Moving and hiding are
  separate, so an off-grid drag always clamps. While hidden, `setWall` may wall over the markers'
  cells; `showMarkers` re-snaps both off any walls, keeping them apart (`nearestEmptyCell`'s `toAvoid`).
- **Only plain cells carry weight.** Walls and weights are separate arrays because they answer
  different questions (can I enter? what does it cost?), so wall checks everywhere stay unchanged.
  `setWall`/`fillWalls` reset the weight and `setWeight` refuses walls, markers and anything below
  `DEFAULT_WEIGHT` (A\* will assume every step costs at least that). A marker dropped on terrain
  keeps the stored weight, so the terrain is back when it moves on. It never counts: no path enters
  the start, every path enters the goal once, so `getGridSnapshot` sets both to the default in its
  copy and the painter draws them plain. `clearWalls` keeps weights for a future "Clear walls".
- `refresh()` is the manual dirty flag — most mutators (all but `reset`/`resize`) don't bump `gridVersion` themselves;
  callers (`CanvasGrid`'s pointer handlers) call `api.refresh()` once per real change, and
  mazes once at the end, so a maze doesn't bump the version per cell.
- `reset(rows?, cols?, cellSize?)` builds a fresh empty grid via `initGrid` (start/goal re-placed
  for the new size; no arguments = the `utils/constants.ts` defaults). It **bumps** `gridVersion`
  rather than restarting at 0: runners are cached by the version they were built from, so a
  restart could make a runner built for the old grid look current.
- `resize(cellSize)` changes only the drawn cell size (dimensions, walls and markers are kept),
  clamped to `[MIN_CELL, MAX_CELL]`. It bumps `gridVersion` so a finished run is re-solved and
  repainted at the new size, and is a no-op when the clamped size equals the current one.
  Rows/cols are only ever chosen by `reset`; the grid dimensions are not user-configurable.

`GridSnapShot` (= `Grid` without `markersHidden`, no methods) is what gets handed to algorithms/mazes — a frozen,
plain-data copy so a generator's view of the grid can't be mutated mid-run by further
pointer input (see §4).

### `useSettingsStore` (`features/store/useSettingsStore.ts`) — UI/session state

The user's selections: `algoKey`, `speed` (`'slow'|'medium'|'fast'`) and `tool` (`DrawTool`: Wall
or a weight level). This is the **only** copy: the pickers write here and nothing else.
`useAlgoController` reads from here (the speed preset live, converted via
`utils/settings.ts:speedToEPS`; the algorithm with `getState()` when a run starts, see §7), and
`CanvasGrid` reads the tool when a drag starts (§9). Keeping one copy means the two can't drift apart. The
maze dropdown is an action menu (picking a maze generates it now), so no maze key is stored.

### State that intentionally lives outside Zustand

High-frequency/imperative state is kept in `useRef`/local `useState` inside hooks rather than
in a store, because it changes many times per second during playback and/or must survive
across renders without forcing re-renders:

- `useAlgoController`: `runners` (a `Map<algoKey, {runner, buildVersion}>` holding the active
  run; it never holds more than one, see §7), `currentAlgoRef` (the active run's key, for
  synchronous reads in callbacks), `cancelPathAnimRef`, `sawPathEventRef`, `speedRef`.
- `useMazeGenerator`: `runnerRef`, a cleanup closure ref that restores start/goal.
- `CanvasGrid`: `dragModeRef` (paint / erase / move-start / move-goal), fixed once per drag.
- `useInfoModal` (`features/hooks/`): the info dialog's `open` state, owned by `GridPage` and
  shared by the toolbar's button and `InfoModal`. Its initial value comes from `localStorage`
  (`algoviz:info-seen`): the dialog opens on a first visit and is marked seen when it is closed.
  This is the only thing the app persists.

**Modal open state** (`components/Modal`): the parent's `open` prop is the truth and the native
`<dialog>` follows it (an effect calls `showModal()`/`close()`, guarded on `dialog.open` for Strict
Mode). When the browser closes it on its own (Esc, the X or the backdrop, all
`<form method="dialog">`), the native `close` event calls `onModalClosed` so the parent's state
follows back. Without that, the parent would still think it's open and the info button would do
nothing after an Esc.

## 3. Canvas rendering layer

`components/useCanvasLayer.ts` is the low-level hook: given `rows/cols/cellSize`, it sizes a
`<canvas>` for devicePixelRatio (`ctx.setTransform(dpr,0,0,dpr,0,0)`, disables image
smoothing for crisp cell edges) and exposes `getCtx()`, a **stable** function (`useCallback`),
so callers can list it in effect deps without re-running the effect on every render. Besides
the grid, `ui/Legend.tsx` uses it for its swatches. It sizes the canvas in a
**`useLayoutEffect`**: assigning `canvas.width` wipes its pixels, and layout effects run before
every passive effect, so the canvas is resized first and the algorithm controller's
`useEffect` then repaints onto the resized canvas (with a plain `useEffect` the resize would
run after the repaint and erase a finished path). `components/CanvasStage.tsx` stacks
two of these — `base` (pointer-events auto) and `overlay` (`pointer-events: none`,
absolutely positioned on top) — and exposes both contexts via `useImperativeHandle`.

`features/CanvasGrid/CanvasGrid.tsx` owns a `CanvasStage` and is the thing everything else
talks to:

- Subscribes to `useGridStore` with `useShallow` for `[rows, cols, cellSize, cells, weights, start,
goal, markersHidden]`.
- One `useEffect`, debounced through `useRaf()` (coalesces multiple state changes within one
  animation frame into a single draw call), redraws the **base** layer via
  `painters.drawBaseScene(...)` whenever grid data changes. It does **not** touch the overlay:
  every dimension change (`reset`/`resize`) bumps `gridVersion`, and the controller's rebuild
  clears and repaints the overlay itself (see §7). A separate overlay clear here would run a
  frame later and wipe the repainted path.
- Exposes `CanvasGridHandle` (`getBaseCtx`, `getOverlayCtx`, `clearOverlay`, `redrawBase`) via
  `useImperativeHandle` — this is the handle `ui/Grid.tsx` holds and hands to `useAlgoController`.
- Owns all pointer interaction (see §9).

### Painters (`features/painters/`) — pure drawing functions, no state

- `basePainter.ts`: `drawBaseScene(scene)` takes one scene object = clear+fill background → paint
  every cell (wall, weight tint or empty color, with a 0.25px overdraw fudge to avoid antialiasing
  seams between adjacent same-kind cells; marker cells are always plain) → `drawGridLines` (skips
  the line segment between two adjacent wall cells, so wall blocks render as solid contiguous
  shapes) → weight dots → outer border → `drawMarkers` unless hidden (start = arrow glyph, goal =
  ringed dot). The 1-3 dots (`drawWeightDots`) make the level readable without colour; they are
  skipped below `WEIGHT_DOTS_MIN_CELL` (16px), where they'd be noise. `drawStartMarker`,
  `drawGoalMarker` and `drawWeightDots` are exported on their own too: the legend draws its swatches
  with them, so the legend can't drift from the grid.
- `overlayPainter.ts`: `paintAlgoEvent` switches on `AlgoEvent.type` and fills one cell
  (`frontier` color for `enqueue`, `visited` color for `visit`); `path` events are only
  instant-painted if `drawPathInstant` is passed (otherwise the runner leaves it to
  `animateFinalPath`). `animateFinalPath` runs its **own independent rAF loop** (not the
  generator runner) that fills `nps` (nodes-per-second, default 240) path cells per second
  until done, returning a cancel function. `clearOverlay` is a plain `ctx.clearRect`.
- `colors.ts`: `GridPalette` with a `lightPalette` and `darkPalette`, including `weights` (one tint
  per `WEIGHT_LEVELS` entry, same order) and `weightMark` (the dots). `weightLevel(w)` and
  `weightColor(w)` turn a stored weight into its level index and tint. **`darkPalette` is
  currently identical to `lightPalette`**, and both painter modules hardcode
  `import { lightPalette as palette }` — there is no theme-switching logic anywhere in the
  app despite the two-palette scaffold.

## 4. Algorithms & the event-generator pattern

`types/algo.ts`:

```ts
type AlgoEvent =
    | { type: 'enqueue'; at: Coord }
    | { type: 'visit'; at: Coord }
    | { type: 'path'; nodes: Coord[]; visited: number; cost: number };
type PathFinder = (grid: GridSnapShot) => Generator<AlgoEvent, void, void>;
```

Every algorithm in `features/algo/*.ts` (`bfs`, `dfs`, `dijkstra`, `bidirectionalBfs`) is a
generator function matching `PathFinder`. Shape is consistent across all four:

1. Build local closures over the snapshot: `id(coord)`, `inb(coord)`, `isWall(coord)`,
   `getCoord(id)` — **re-implemented per file** rather than shared.
2. Seed the frontier structure (`Queue` for bfs/bidirectional, plain array-as-stack for dfs,
   `min_priority_queue` binary heap for dijkstra), `yield {type:'enqueue', at:start}`.
3. Main loop: pop next node, `yield {type:'visit', ...}`, expand `neighbors4` (4-directional,
   `features/algo/utils.ts`), track `seen`/`dist` in typed arrays (`Uint8Array`/`Int32Array`
   sized `rows*cols`) and `parent` pointers for path reconstruction, `yield {type:'enqueue'}`
   for each newly-discovered neighbor, stop early the instant `goal` is reached.
4. Reconstruct the path by walking `parent` back from `goal`, reverse it, and
   `yield {type:'path', nodes, visited}` exactly once, as the generator's final yield.

`dijkstra` is the one algorithm that reads `weights`: stepping into a cell costs `weights[cell]`. It
stops when the goal is **popped**, not when it is first enqueued, because with weights the first
route to reach a cell isn't always the cheapest (BFS can stop on enqueue; Dijkstra can't). On a
plain grid it matches BFS's path length, at the cost of the heap.

Every algorithm reports `cost` on its `path` event through the shared `pathCost(nodes, grid)` in
`features/algo/utils.ts`: the sum of the weights of every cell after the first, since a path never
enters its start. So an algorithm that ignores weights while searching still reports what its path
really costs, which is how the stats panel shows the difference. Marker cells need no special case:
the snapshot already sets them to the default weight.

`bidirectionalBfs` runs two independent BFS frontiers (`queue[0]` from start, `queue[1]` from
goal) in lockstep, alternating one pop per frontier per outer loop iteration, and stops the
instant a node expanded by one side is already `seen` by the other (`mid`). The path is
stitched by walking `parent[0]` back from `mid` to start (reversed) then `parent[1]` forward
from `mid` to goal.

Algorithms are pure functions of the snapshot — they never touch Zustand directly. All
grid-store interaction happens in the runner's event callback (`useAlgoController`), which is
what lets `getGridSnapshot()` (`features/animations/utils.ts`) safely `.slice()` the cells
array once up front and hand algorithms an immutable view.

## 5. Maze generators & the same pattern, different event set

`types/mazeGenerator.ts`:

```ts
type MazeGeneratorEvent =
    | { type: 'fill-wall' }
    | { type: 'clear-wall' }
    | { type: 'carve'; at: Coord }
    | { type: 'wall'; at: Coord }
    | { type: 'done' };
type MazeGenerator = (rows: number, cols: number) => Generator<MazeGeneratorEvent, void, void>;
```

`features/mazes/*.ts`:

- `random.ts` (`randomGenerator`): clears walls, then for every even-coordinate-skip cell,
  probabilistically emits a `wall` event (`wall_prob = 0.35`).
- `floodFill.ts`: fills walls, then a randomized iterative DFS backtracker over the
  "odd/odd" cell lattice (standard maze-on-a-grid technique — real cells sit at odd
  coordinates, walls between them at even coordinates), carving the midpoint wall + the new
  cell as it advances, backtracking via a stack when a cell has no unvisited neighbors.
- `prims.ts`: fills walls, randomized Prim's algorithm over the same odd/odd lattice —
  maintains a `frontiers` list of candidate walls, randomly picks one, carves it plus the
  cell on the far side if that cell is unvisited.
- `recursiveDivision.ts`: **a factory**, `recursiveDivision(vertical_prob = 0.5) => MazeGenerator`.
  Clears walls, draws the outer boundary, then recursively bisects the interior with a
  vertical or horizontal wall (weighted by `vertical_prob`) that has exactly one carved gap,
  pushing the two sub-chambers onto explicit stacks (`row_stack`/`col_stack`) instead of
  recursing, until a chamber is too small to divide further. `mazes/index.ts` calls this
  factory three times with different skew probabilities (0.5 default, 0.7 vertical-skewed,
  0.3 horizontal-skewed) to register three distinct maze options from one implementation.

All maze generators operate on the _lattice coordinates directly_ (no `GridSnapShot`
needed since they don't read existing walls) — they take `(rows, cols)` and yield
coordinate-only events, which is why `useMazeGenerator` can restore/relocate start & goal
independently after the run.

## 6. The runner — generic playback engine

`features/animations/runner.ts:createRunner<TYield>(gen, onEvent, opts)`. This is the single
piece of code that both algorithms and mazes are played back through; neither `AlgoEvent` nor
`MazeGeneratorEvent` are known to it — it's generic over `TYield`.

- Converts a `speed` (events-per-second, default 120) into `perFrame = ceil(eps/60)`, clamped
  to `maxBatchPerFrame` (default 1000), assuming a 60Hz `requestAnimationFrame` cadence.
- `play()`: sets `running=true`, schedules `tick` via rAF. Each `tick` pulls up to `perFrame`
  events from the generator synchronously, calling `onEvent(value)` for each, then
  re-schedules itself — until the generator reports `done`, at which point it calls
  `opts.onFinish?.()`.
- `pause()`: cancels the rAF and flips `running=false` (generator position is preserved —
  resuming continues exactly where it left off, since it's a real JS generator).
- `step()`: pulls exactly one event and leaves the runner paused (it stops a running loop).
- `skipToEnd()`: drains the generator synchronously in a `while` loop (no rAF), firing
  `onEvent` for every remaining event — this is what makes "grid edited while a finished
  algorithm's overlay is stale" resolve instantly rather than by dropping frames.
- `setSpeed(eps)`: updates the closure variable read by the next `tick`; takes effect
  immediately, no restart needed.
- `getStatus()` returns its `AlgoStatus` (`initial|running|paused|done`).
- `onStatusChange(status)` (option): called on every status **change**, including the run
  finishing on its own inside a frame, but not for the initial status. Every transition goes
  through one internal `setStatus`, so no code path can forget to report. The runner is the
  single source of truth for status; callers never set one of their own.

## 7. `useAlgoController` — orchestrates algorithm playback

This is the biggest piece of glue. Responsibilities:

- **Selected vs active**: the _selected_ algorithm and speed live in `useSettingsStore` (§2); the
  controller owns only the _active_ run, the one on screen (`currentAlgoRef` + `runAlgo` state).
  Changing the selection doesn't touch the active run. `getOrCreateCurrent()` decides which
  runner a control acts on: the active one while it is running (even if another algorithm was
  selected meanwhile) or paused on the selected algorithm; otherwise a fresh run of the selected
  algorithm. The selection is read with `getState()` rather than subscribed to, so it takes
  effect when a control is used, not when the dropdown changes. `pause()` acts on the active
  runner directly and never creates one.
- **Runner bookkeeping**: `runners: Map<algoKey, {runner, buildVersion}>`. Starting a run cleans
  up the previous one (`cleanupPreviousRun`: pause, cancel the path animation, clear the
  overlay, reset stats, drop it from the map), so the map holds at most the active run. (A
  single `activeRef` would say this more directly; planned for the refactor.)
- **Speed**: subscribes to the store's preset and applies it to the active runner in an effect,
  so a change takes effect mid-run; `speedRef` gives new runners the current speed.
- **Grid-version invalidation**: `getOrCreateCurrent()` compares the cached runner's
  `buildVersion` against the live `gridVersion` (from `useGridStore`); a mismatch triggers a
  fresh `createRunnerFor`. A separate `useEffect` watches `gridVersion` directly: if the
  _currently displayed_ algorithm's cached build is stale, it immediately rebuilds — and if
  the old runner had already finished (`AlgoStatus.done`), the rebuild is played back
  **instantly** (`instant=true` → `drawPathInstant` + `r.skipToEnd()`) so editing the grid
  after a completed run doesn't require re-clicking Visualize to see the corrected path.
  The rebuild uses the **active** algorithm, not the selected one, since the active run is what
  is on screen.
  If the old runner was **running** (e.g. the grid was resized mid-run), the run is abandoned:
  the rebuild leaves status `initial` (ready) and the controller releases `gridLock`, which `play()`
  took. It releases the lock only in that case, because `gridLock` is shared with the maze
  generator, and a resize mid-maze must not let the user paint over a half-carved maze. The
  runner's status is read _before_ the rebuild, since pausing a running runner changes it.
- **Event → paint wiring** (`getEventHandler`): grabs the overlay ctx once per snapshot, and
  returns a closure that calls `paintAlgoEvent` for every event, tracks `visitedApprox`
  (incremented on `visit`), and on the terminal `path` event: sets `pathLen` and `pathCost`, unlocks the
  grid (`setGridLock(false)`), and — unless `instant` — cancels any prior path animation and
  starts a new one via `animateFinalPath`, whose per-frame callback keeps the start/goal
  markers redrawn on top (since the overlay animation paints over them cell-by-cell).
- **Status**: `AlgoStatus | undefined` (`undefined` = no run yet), set **only** from the
  runner's `onStatusChange`; controls never set it. A new runner reports nothing at creation,
  so `createRunnerFor` writes its starting status (`initial`) itself, _after_
  `cleanupPreviousRun`: pausing the old runner reports `paused`, and the later write wins. This
  is safe because a paused runner never reports again (its frame loop is cancelled). `play()`
  locks the grid; `pause()`/finishing unlocks it.
- **`clear()`**: discards the active run and builds a fresh one for the _selected_ algorithm
  (status `initial`, stats reset, overlay cleared), so Visualize afterwards starts over rather
  than resuming. Used by the toolbar's "Clear path" button and before starting a maze.
- Cleanup on unmount pauses every cached runner and cancels any in-flight path animation.

## 8. `useMazeGenerator` — orchestrates maze playback

Simpler and structurally different from the algorithm controller: it drives events straight
into `useGridStore` mutators instead of a canvas painter, because maze cells _are_ grid
state (walls), not an overlay.

Sequence on `generate(key)`:

1. Pause/discard any previous maze runner + pending cleanup closure.
2. **Hide the markers** (`hideMarkers()`) and **lock the grid** — this both hides the markers
   during carving and stops the player from painting walls mid-generation.
3. Build the generator from `(rows, cols)` and wrap it in `createRunner`, whose `onEvent`
   applies `fillWalls`/`clearWalls`/`setWall`/`clearWall` directly for each event type. A maze is a
   fresh board: `fill-wall` drops weights by itself, and `clear-wall` also calls `clearWeights`
   (the store's `clearWalls` keeps terrain on purpose).
4. On the generator's `done` event, run the stored cleanup closure: `showMarkers()` (re-snapped
   if the maze walled over them), unlock the grid, and `refresh()`.
5. `runnerRef.current.play()` — maze generation always autoplays (no pause/step controls are
   wired to it from the toolbar; `AlgoPickers.onGenerateMaze` also calls
   `algoController.clear()` first so a stale path overlay doesn't linger under the new maze).

## 9. Pointer interaction (`CanvasGrid`)

Single-pointer state machine via `DragMode` (`None | Paint | Erase | MoveStart | MoveGoal`), driven
by native Pointer Events (`onPointerDown/Move/Up/Leave/Cancel`) with `setPointerCapture` so drags
tracked outside the canvas bounds still deliver move events.

- `hitCell(e)`: converts client coords to `{r,c}` via the wrapper's bounding rect and
  `cellSize` (no rounding/clamping to grid bounds — out-of-range is filtered by `paintAt`).
- **Tool vs drag mode:** the tool (`DrawTool`, picked in the legend) says which layer a drag edits;
  the drag mode says whether it paints or erases that layer. Both are fixed at pointer down, so one
  drag never mixes the two.
- `onPointerDown`: no-ops if `gridLock`. If the hit cell is the start or goal marker, enters
  `MoveStart`/`MoveGoal` drag mode. Otherwise it picks `Erase` if the right mouse button or Alt is
  held or the starting cell matches the tool (a wall for the wall tool, the **same level** for the
  weight tool, so a different level is painted over rather than erased), else `Paint`. This is also
  how touch erases, with no right button or Alt. Then paints immediately. The start cell is
  bounds-checked first: cells are a flat array, so an out-of-range column would read the next row's
  cell.
- `onPointerMove`: continues painting or dragging the active marker per the drag mode, and calls
  `api.refresh()` only if a cell or marker actually changed. A `gridVersion` bump invalidates
  runners and re-solves a finished run, and `pointermove` fires many times per cell.
- `onPointerUp`/`onPointerLeave`/`onPointerCancel`: releases pointer capture, resets the drag mode
  to `None` (cancel: the browser or OS took over the gesture, so no `pointerup` will follow).
- The wrapper sets `touch-action: none`, so a touch drag paints instead of scrolling the page.
- `paintAt`: guards bounds and refuses to paint over the start/goal cell, then routes by tool and
  drag mode to `setWall`/`clearWall`/`setWeight`/`clearWeight`, returning whether anything changed.
  The wall tool paints over terrain (dropping its weight); the weight tool skips walls.
- Right-click context menu is suppressed (`onContextMenu` → `preventDefault`) since
  right-click is repurposed as an erase trigger.

## 10. End-to-end flow: clicking "Visualize"

1. `PlaybackControls`'s Visualize button calls `algo.play()` on the controller `GridPage` owns.
2. `play()` → `getOrCreateCurrent()`: keeps the active runner if it can be resumed (see §7);
   otherwise (no runner, the grid changed since it was built, it finished, or a different
   algorithm is now selected) builds a fresh one for the selected algorithm via `createRunnerFor`.
3. `createRunnerFor`: snapshots the grid (`getGridSnapshot`, returns `null` if start/goal
   invalid — controller bails out), cleans up the previous run (pause, clear the overlay, reset
   stats), instantiates the algorithm generator (`algo(snap)`), wraps it in `createRunner` with
   the current `speedRef`, an `onFinish` fallback and `onStatusChange`, records it as the active
   run with the snapshot's `gridVersion`, and sets status `initial`.
4. `useGridStore.setGridLock(true)` — pointer painting is now inert.
5. `runner.play()` starts the rAF tick loop; each tick pulls `eps/60` events and invokes the
   `onEvent` closure from `getEventHandler`, which paints `enqueue`/`visit` cells onto the
   **overlay** canvas immediately (no React render involved — this is why the visualization
   can run at high event rates without janking React).
6. When the generator yields its terminal `path` event: grid unlocks, `pathLen` updates, and
   `animateFinalPath` takes over with
   its own independent rAF loop to trace the path cell-by-cell at `pathNps` (240/s default),
   re-drawing the start/goal markers on top each frame. When the generator then returns, the
   runner reports `done` through `onStatusChange`.
7. Meanwhile the **base** layer is untouched throughout — it only redraws in response to
   `useGridStore` changes (wall edits, marker moves), which is exactly what keeps grid
   editing and algorithm animation on separate, non-interfering render paths.

Changing the grid after a run started: pointer edits are blocked while running (`gridLock`),
so this happens through edits while paused or finished, or a resize (which can happen mid-run).
Any wall, weight or marker edit + `refresh()`, or `resize`, bumps `gridVersion`. The
controller's `useEffect` on `gridVersion` rebuilds the active run from the new snapshot — if the
prior run had already reached `done`, the rebuild is instantly skipped-to-end so the corrected
path reappears without user action; otherwise it is left at `initial` status (press Visualize
again; an unfinished run is not auto-replayed).
