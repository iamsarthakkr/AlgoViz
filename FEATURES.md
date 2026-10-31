# Features

What the app does today, ordered core-first. For _how_ each is implemented in depth, see
[ARCHITECTURE.md](./ARCHITECTURE.md).

## 1. Interactive wall-painting grid

The core surface: a canvas grid (`features/CanvasGrid`) of empty, wall and weighted cells (§9).
Dragging (mouse, touch or pen) paints with the tool picked in the legend; a drag that **starts on
a matching cell** erases instead, which is how touch users erase. Right-click-drag or Alt+drag also
erases. The choice is made once per drag, so a single drag either draws or erases every cell it
crosses, never a mix.

- Implementation: `CanvasGrid.tsx`'s pointer handlers (`onPointerDown/Move/Up`) compute the
  hit cell from client coordinates, choose `Paint` or `Erase` from the tool, the starting cell
  and the mouse button/modifier key, and write into `useGridStore`, refreshing only on real changes.
- Interacts with: the base canvas layer redraws via `drawBaseScene` any time grid state
  changes; a running algorithm locks the grid (`gridLock`) so painting is disabled mid-run.

## 2. Start/goal markers

Two special cells — start (arrow glyph) and goal (ringed dot) — are draggable by
click-and-hold directly on them. Dropping a marker onto (or near) a wall snaps it to the
nearest empty cell via a small internal BFS rather than landing inside a wall. A marker can't
be dropped on top of the other marker.

- Implementation: `DragMode.MoveStart`/`MoveGoal` in `CanvasGrid.tsx`'s pointer state
  machine; snapping logic lives in `useGridStore.setStart`/`setGoal` calling
  `utils/grid.ts:nearestEmptyCell`.
- Interacts with: algorithms won't run without both markers present on non-wall cells
  (`getGridSnapshot` returns `null` while `markersHidden` is set, which silently no-ops
  Visualize/Step); maze generation temporarily hides both markers (see §4) and restores
  them afterward, re-snapping if the maze happened to wall over their old position.

## 3. Pathfinding algorithms (Visualize / Step / Pause / Skip-to-end / Clear)

Four algorithms, selectable from the "Algorithm" dropdown in the toolbar. They are listed once,
with their metadata (whether they read weights, when their path is guaranteed cheapest, a
one-line description), in `features/algo/registry.ts`; the dropdown, the settings store's default,
the controller's lookup and the info dialog are all derived from that list:

| Algorithm            | File                  | Notes                                                                                                                           |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Breadth-first search | `bfs.ts`              | Guarantees the shortest path on an unweighted grid, ignores weights; ring-buffer `Queue`.                                       |
| Depth-first search   | `dfs.ts`              | Explores greedily, does **not** guarantee shortest path; explicit array-as-stack.                                               |
| Bidirectional BFS    | `bidirectionalBfs.ts` | Two BFS frontiers grown from start and goal simultaneously, meeting in the middle; typically visits fewer cells than plain BFS. |
| Dijkstra's           | `dijkstra.ts`         | Reads weights and always finds the cheapest path; binary min-heap priority queue (`store/priority_queue.ts`).                   |

Each algorithm is a generator that yields one event per unit of work
(`enqueue`/`visit`/final `path`) rather than computing the answer up front — this is what
enables every control below without algorithm-specific code:

- **Visualize** (play): runs the generator at the selected speed via a `requestAnimationFrame`
  loop, painting `frontier`/`visited` colors onto the overlay canvas as events arrive, then
  animates the final path cell-by-cell once found.
- **Pause**: stops the playback loop mid-run without losing generator state; the same button
  slot becomes **Step** when not running.
- **Step**: advances exactly one event and re-pauses — useful for inspecting algorithm
  behavior one cell at a time.
- **Skip-to-end**: (available programmatically via `algoController.skipToEnd`, e.g. triggered
  automatically when the grid changes after a run had already completed) drains the rest of
  the generator instantly and paints the final path with no animation.
- **Clear path**: discards the current run's progress, rebuilds a fresh (not-yet-started)
  generator for the selected algorithm from the live grid, and clears the overlay canvas.
  Visualize afterwards starts over; a paused run is not resumed.
- **Speed**: `slow` / `medium` / `fast` presets (`utils/settings.ts:speedToEPS` → 80 / 220 /
  600 simulated events per second), changeable live, mid-run, without restarting.

Picking a different algorithm only changes the **selection** (stored in `useSettingsStore`); the
run on screen is left alone. A run in progress keeps going to its own path, and Pause still
pauses it. The new algorithm is used the next time a run starts: Visualize or Step on a paused
or finished run discards it and starts the newly selected algorithm.

Editing the grid (walls/markers) while a **finished** visualization is showing automatically
re-solves and re-draws the path instantly (no animation replay, no need to press Visualize
again). While a run is **in progress** the grid is locked against edits; editing a **paused**
run, or resizing the window mid-run, discards the unfinished run, and the user presses
Visualize again to replay against the new grid.

## 4. Maze & pattern generation

A second dropdown ("Mazes & Patterns", `features/mazes/index.ts`) fills the grid with a
generated wall pattern, animated the same way algorithms are (generator + `requestAnimationFrame`
runner), but writing directly into the grid store instead of a canvas overlay:

| Pattern                              | File                                         | Technique                                                                                     |
| ------------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Recursive Division                   | `recursiveDivision.ts` (`vertical_prob=0.5`) | Recursively bisects the interior with single-gap walls, unbiased direction choice.            |
| Recursive Division (vertical skew)   | same file (`vertical_prob=0.7`)              | Same algorithm, biased toward vertical dividing walls → more horizontally elongated chambers. |
| Recursive Division (horizontal skew) | same file (`vertical_prob=0.3`)              | Biased toward horizontal dividing walls.                                                      |
| Prim's                               | `prims.ts`                                   | Randomized minimum-spanning-tree carve over the odd/odd cell lattice.                         |
| Randomized Depth First Search        | `floodFill.ts`                               | Iterative backtracking carve (classic "growing tree" maze).                                   |
| Random Walls                         | `random.ts`                                  | Independent per-cell coin flip (35% wall probability), no connectivity guarantee.             |

Behavior common to all patterns:

- Generating a maze first calls `algoController.clear()` (discarding any visualized path so
  it doesn't linger under the new walls), then hides the start/goal markers and **locks the
  grid** for the duration of generation, then restores the markers (re-snapped off any wall
  the maze happened to place under them) and unlocks the grid once the generator's terminal
  `done` event fires.
- Generation always autoplays at a fixed internal speed (120 events/sec) — there's no
  pause/step exposed for maze generation from the toolbar, unlike algorithm playback.
- Recursive Division's three toolbar entries come from a single implementation parameterized
  by a probability, rather than three separate files — a useful pattern to mirror for future
  maze variants that only differ by a tunable parameter.

## 5. Live run stats

For the active run, `useAlgoController` tracks and exposes:

- `visitedApprox` — count of cells visited so far (increments on every `visit` event).
- `pathLen` — the number of cells on the final path (both endpoints included) once found;
  `undefined` until then, and `0` if the run finishes without reaching the goal.
- `pathCost` — what the path really costs (the weight of every cell entered), `undefined` until a
  path is found. Reported by every algorithm, including those that ignore weights while searching.
- `status` — the runner's `AlgoStatus` (`initial` = ready, `running`, `paused`, `done`), or
  `undefined` before the first run. It comes only from the runner (`onStatusChange`).
- `runAlgo` — the algorithm of the run these numbers belong to (the active run, which can
  differ from the dropdown's selection until the next run starts).

`ui/Stats.tsx` renders them (`Grid.tsx` passes the values as props):

- **Algo**: `runAlgo` (the run the numbers belong to).
- **Status**: Ready / Running / Paused / Finished.
- **Visited**: `visitedApprox`.
- **Path**: the path length in **steps** (`pathLen - 1`, since `pathLen` counts both
  endpoints); "No path" when the run finished without reaching the goal.
- **Cost**: `pathCost`. Equal to the steps on a plain grid; comparing it across algorithms shows
  what ignoring weights costs.
- **Note**: what the _selected_ algorithm guarantees, from its registry `shortest` flag, in red when,
  on this grid, its path may not be the cheapest: always for `never`, and for `unweighted-only` only
  once the grid has weights. It has a fixed two-line height on
  phones, because picking another algorithm mid-run must not change the row's height.

Phones show Status, Visited, Path and Cost; Algo is desktop-only, since the header picker names the
algorithm there (it can briefly differ after a switch mid-run).

Before the first run, Status, Path and Cost show a "-" placeholder (Algo currently shows the selected
algorithm until the controller's planned `activeRef` refactor leaves it empty). Every item is rendered in every state:
on phones the stats are an `auto` grid row, so an item appearing or a value wrapping mid-run
would change the row's height, resize the grid and stop the run. Only the status is an
`aria-live` region (the visited count changes every frame). `PlaybackControls.tsx` reads
`status` for its button state.

## 6. Responsive canvas rendering (crisp at any zoom/DPI)

Both canvas layers (base + overlay) are sized for `window.devicePixelRatio`, so grid lines and
markers stay crisp on high-DPI (Retina) displays instead of blurring. This is infrastructural
rather than user-facing, but shapes what "adding a new visual element" requires (draw at
logical, not physical, pixel coordinates — the DPR scale is baked into the canvas transform
once at setup).

## 7. Responsive layout and grid sizing

The app works from a 320px phone to a large monitor. Grid size is not user-configurable; it is
chosen from the screen.

- **Layouts.** Below 1280px (phones, tablets, small laptops): a compact header with the
  algorithm and maze pickers, the grid, the stats and legend, and a bottom bar with Visualize /
  Step / Clear / Speed within thumb reach. From 1280px: one top bar with everything, the legend
  on the left and the stats on the right of the grid. See ARCHITECTURE.md §1 "Page layout".
- **Grid dimensions are picked once, on load** (`utils/layout.ts:pickGridLayout`): columns come
  from a fixed preset list (21 / 35 / 41 / 51) by how wide the grid's box is, rows from its
  height. Rows and columns are always odd (the maze generators carve on odd indices inside a
  wall border). Cell size is a whole number of pixels between 12 and 32.
- **Resizing or rotating keeps the grid** (`fitCellSize`): rows, columns, walls and markers stay;
  only the cell size changes. A finished run is re-solved and repainted at the new size; a run
  in progress is stopped (press Visualize again). Reload to get dimensions picked for the new
  size. If the box is too small even for 12px cells, the grid scrolls instead of shrinking.
- **Touch:** dragging on the grid paints instead of scrolling the page (`touch-action: none`),
  controls are at least 44px tall, and the bottom bar clears the iPhone home bar.
- **Legend**: the **draw palette** (Wall and the weight levels, as toggle buttons) and the **key**
  (Start, Goal, Frontier, Visited, Path). Every swatch is drawn with the grid's own painters and
  palette, so it always matches the grid (visited is drawn over frontier, as on the grid). Rows on
  phones with short labels (×2), a column on desktop. The selected tool is shown with a ring, which
  takes no space, so selecting can't resize the phone's legend row or the grid.
- **Stats**: one row of label-over-value cells on phones, a column on desktop (see §5).

## 8. Info dialog ("About AlgoViz")

The **ⓘ** button next to the title opens a dialog with four short slides: what AlgoViz is, how
to use it, a line per algorithm, and about (author, GitHub link). Arrows on both sides, dots to
jump to a slide, and the ← / → keys page through it; it always opens on the first slide.

- **First visit:** it opens on its own the first time the app is loaded, and is remembered as
  seen once the user closes it (`localStorage` key `algoviz:info-seen`). If storage is blocked
  (e.g. Safari private mode), it simply opens again next time.
- It's a native modal `<dialog>`: Esc, the X or a click outside closes it, focus stays inside
  while open, and the page behind is inert. It takes no layout space, so it doesn't disturb a
  run in progress.
- The algorithms slide renders the registry (`algoRegistry`: each label and its `description`),
  so a new algorithm shows up there automatically (a test checks every entry has a description).
- Implementation: generic shell `components/Modal.tsx`, content `ui/InfoModal.tsx`, state
  `features/hooks/useInfoModal.ts`.

## 9. Weighted cells

Cells can cost more to cross. Pick a weight in the legend (Light ×2, Medium ×5, Heavy ×10,
`WEIGHT_LEVELS`) and drag on the grid; a plain cell costs 1 (`DEFAULT_WEIGHT`).

- **Editing:** a drag that starts on the same level erases weights, and one that starts on a
  different level paints over it, so changing a level takes one drag. Right-click or Alt erases.
  The weight tool skips walls; the wall tool paints over terrain and removes its weight.
- **Drawing:** a tint per level, plus 1-3 dots on cells of at least 16px so the level doesn't rely
  on colour alone.
- **Rules:** the cost is paid on entering a cell. Only plain cells carry weight: a wall never has
  one, and the start and goal cells never count. A marker dragged across terrain doesn't damage it.
- **Mazes** start from a fresh board, so generating one removes all weights.
- **Algorithms:** Dijkstra reads weights and finds the cheapest path. BFS, DFS and Bidirectional BFS
  ignore them, but still report what their path really costs. Editing a weight after a finished run
  re-solves it live. See ARCHITECTURE.md §2 and §4.
