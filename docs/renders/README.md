# Render comparison harness

Two directories:

- **`refs/`** — Ground truth. Blender EEVEE renders, one per camera stop, named after the friendly label in `src/config/cameraStops.ts` (e.g. `desk.png`, `cat.png`). **Committed.** Do not edit.
- **`actual/`** — Playwright captures from the live WebGL view. Used for side-by-side comparison while tuning `src/config/blenderMatch.ts`. **Gitignored** — captures are throwaway.

## How to use

1. `pnpm dev`
2. Open `localhost:5173/?debug-fly`, click the canvas to lock the cursor, fly into roughly the same framing as the reference.
3. Take a 1280×720 screenshot via the Playwright MCP browser tools and save to `actual/<stop>.png`.
4. Open `refs/<stop>.png` and `actual/<stop>.png` side-by-side. Tune the global knobs in `src/config/blenderMatch.ts` (tone-mapping exposure, light intensity multiplier, bloom params, ambient).
5. Reload — view mode is resolved once at module load.

## Available reference stops

`desk`, `bookshelf`, `guitar`, `scoreboard`, `cat`, `telescope`, `posters`, `moon`, `cabinet`.

(`home` has no reference yet.)
