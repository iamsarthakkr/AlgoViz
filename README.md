# AlgoViz

A pathfinding-algorithm visualizer. Paint walls on a grid, place start/goal markers, then
watch a pathfinding algorithm (or generate a maze) animate step by step on canvas.

- **Algorithms**: Breadth-first search, Depth-first search, Bidirectional BFS, Dijkstra's
- **Maze / pattern generators**: Weighted Maze (one click: maze, loops and terrain), Recursive
  Division (+ vertical/horizontal skew), Prim's, Randomized Depth-First Search, Random Walls
- **Terrain and clear actions**: Terrain Blobs, Random Weights, Add Loops; Clear Walls, Clear
  Weights, Clear Board
- **Controls**: Visualize, Pause/Step, Clear path, speed presets (slow/medium/fast)
- **Editing**: pick Wall or a weight in the legend and drag to draw, drag starting on a matching
  cell to erase (or right-click / Alt), drag the start and goal markers to move them
- **Legend and live stats**: what each colour means, plus the run's status, visited cells and
  path length
- **Built-in guide**: an "About" dialog (opens on the first visit) explaining how to use it and
  how each algorithm behaves
- **Responsive**: works on phones, tablets and desktops; touch to draw walls, and the grid is
  sized to the screen on load (resizing rescales it without losing your walls)

See [CLAUDE.md](./CLAUDE.md) for project context and conventions,
[ARCHITECTURE.md](./ARCHITECTURE.md) for how state, rendering, and the algorithm/maze
generator pipeline work, [FEATURES.md](./FEATURES.md) for a feature-by-feature breakdown, and
[DEPLOY.md](./DEPLOY.md) for CI, releases and production deployment.

## Stack

Vite 8 · React 19 · TypeScript · Zustand 5 · Tailwind CSS 4 + daisyUI

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

```bash
npm run dev      # start the Vite dev server
npm run build    # type-check (tsc -b) + static production build into dist/
npm run preview  # serve the production build locally
npm run lint     # eslint
npm test         # vitest (watch mode); npm run test:coverage for a coverage report
```

## Deployment

Docker + nginx behind Caddy on a VPS, with CI and tag-based releases — see [DEPLOY.md](DEPLOY.md).
