# Render comparison harness

Two directories:

- **`refs/`** — Ground truth. Blender EEVEE renders, one per camera stop, named after the friendly label in `src/config/cameraStops.ts` (e.g. `desk.png`, `cv.png`). 1280×720. **Committed.** Do not edit.
- **`actual/`** — Playwright captures from the live WebGL view. Used for side-by-side comparison. **Gitignored** — captures are throwaway.

`overview.png` sits beside them: a whole-room render that is **not** a camera stop. It exists to make the space legible; the comparison loop ignores it.

## Available reference stops

All 11, re-rendered from the **v13** export on 2026-08-10:

`home`, `cv`, `desk`, `scoreboard`, `bookshelf`, `cabinet`, `cat`, `guitar`, `posters`, `telescope`, `moon`.

Re-render every reference whenever the Blender cameras move. Four framings changed between v12 and v13 (bookshelf, cv, scoreboard, home), which silently invalidated the previous set — a stale reference makes the comparison loop report drift that isn't there, or hide drift that is.

## How to use

1. `pnpm dev`
2. Open `localhost:5173/?stop=<label>` — a deterministic snap to that stop, which is what makes captures reproducible.
3. Capture at 1280×720 into `actual/<stop>.png`.
4. Compare against `refs/<stop>.png`.

**If the colors are wrong, the bake is wrong.** The runtime is unlit by construction (`src/config/renderPipeline.ts`: `MeshBasicMaterial`, `NoToneMapping`, zero lights) — there is no exposure or tone-mapping knob left to turn. Fix it in Blender and re-export. The old `src/config/blenderMatch.ts` calibration belonged to the lit export and no longer exists.
