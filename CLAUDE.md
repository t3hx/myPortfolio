# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`).

- `pnpm dev` — Vite dev server with HMR.
- `pnpm build` — production build to `dist/` (does **not** type-check; run `type-check` separately).
- `pnpm type-check` — `vue-tsc --build` over the project references in `tsconfig.json`.
- `pnpm preview` — serve the production build locally.

There are no tests, no linter, and no formatter configured.

## Architecture

This is a **TresJS v5 + Vue 3** single-page portfolio that renders a Blender-authored room (`/public/models/scene.glb`) and runs a guided camera tour between named "stop" cameras baked into the `.glb`.

### Render pipeline (top-down)

1. `src/main.ts` → `App.vue` → `components/PortfolioScene.vue` is the only top-level scene.
2. `PortfolioScene.vue` owns the `<TresCanvas>`, the **single render `<TresPerspectiveCamera>`**, and the lifecycle: it `Suspense`-loads `RoomModel`, waits for the `ready` event (which carries the extracted stop transforms), then mounts `TourControls`.
3. `PortfolioScene.vue` resolves a **view mode** from the URL at module load (see `composables/useViewMode.ts`) and chooses control rig + HUD from there. The other top-level flag is `postFx` — enables the optional `<PostFx>` bloom + AgX tone-mapping pass. When on, canvas `tone-mapping` is forced to `NoToneMapping` because the pass does it last instead.

### View modes (URL-driven)

- `/` → **default mode** (production): scene only, no HUD, no fly controls. Camera snaps to the Home stop.
- `/?debug` → **tour mode** (diagnostic): guided camera tour with the `<TourControls>` HUD.
- `/?debug-fly` → **fly mode** (diagnostic): cientos `<KeyboardControls>` (PointerLock + WASD/ZQSD-equivalent + arrows) for free first-person navigation; no HUD, just a hint overlay.

Mode is resolved once at module load and held as a plain `const` — switching modes is a page reload by design (avoids tearing down/recreating control rigs and pointer-lock state mid-session). To add a new mode: extend the `ViewMode` union and the `resolve()` in `useViewMode.ts`, then branch on it in `PortfolioScene.vue`.

### The camera-tour trick (most important concept)

The `.glb`'s own cameras are **never made active**. Instead:

- `components/RoomModel.vue` traverses the loaded scene, finds each node named in `config/cameraStops.ts` (`CameraStop_Home`, `CameraStop_Desk`, …), and extracts its world position / quaternion / fov into a `Map<string, StopTransform>`. This map is emitted to `PortfolioScene` via the `ready` event.
- `composables/useCameraTour.ts` then **tweens the single render camera** to those transforms via GSAP: `lerpVectors` for position, `slerp` for orientation, linear interp for fov. Because fov is animated too, focal-length changes (e.g. the 20 mm wide shot → 270 mm telescope zoom on `CameraStop_TelescopeMoon`) come for free.
- Adding/removing a stop is a two-place change: name the camera correctly in Blender so it survives export, then add an entry to `CAMERA_STOPS` in `src/config/cameraStops.ts`. Order in that array = order in the HUD.

### Blender match (color / lighting fidelity)

`src/config/blenderMatch.ts` is the **single source of truth** for matching the EEVEE viewport in WebGL. It exports the tone mapping (`AgXToneMapping`), exposure, output color space, clear color, ambient fill, light intensity multiplier, and the list of light-name substrings that should cast shadows. glTF doesn't store per-light shadow flags or Three's tone-mapping choice, so `RoomModel.vue` re-applies these on load by traversing the scene graph. If colors or shadows drift after a re-export, this file is where to tune.

`MODEL_SRC` lives here too (`/models/scene.glb`). The model is expected at `public/models/scene.glb`; there's a checklist for the Blender export at `public/models/README.txt`.

### Animations

Any clips in the `.glb` (e.g. the curtain) are auto-played: `RoomModel.vue` creates an `AnimationMixer`, plays every `gltf.animations` clip, and steps it inside `useLoop()`'s `onBeforeRender`.

## Conventions

- Path alias `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig.app.json`). Use `@/components/...`, not relative paths.
- `vite.config.ts` spreads `templateCompilerOptions` from `@tresjs/core` so `<TresXxx>` tags are recognized by the Vue compiler — don't remove it.
- `useGLTF` from `@tresjs/cientos` is **reactive, not awaitable**; the loaded scene appears on `state.value`. The existing `watch(state, …, { immediate: true })` pattern in `RoomModel.vue` is the correct way to react to it — do not try to `await` it.
- The render camera's initial position in `PortfolioScene.vue` is a deliberate seed near the Home stop so frame 0 isn't at the origin; `useCameraTour` then `snapTo`s the real first stop the moment the model's stop map is populated.
