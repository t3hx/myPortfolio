# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`).

- `pnpm dev` — Vite dev server with HMR.
- `pnpm build` — production build to `dist/` (does **not** type-check; run `type-check` separately).
- `pnpm type-check` — `tsc --noEmit`.
- `pnpm preview` — serve the production build locally.

There are no tests, no linter, and no formatter configured yet (Vitest + Playwright are planned — see the design doc's eng review).

## Architecture

This is a **React 19 + react-three-fiber v9** single-page portfolio that renders a Blender-authored room and runs a stop-to-stop camera tour. It began as the "scroll spike" of the rebuild (branch `feat/spike-scroll-r3f`) and is the skeleton the full product grows from. The previous Vue 3 + TresJS prototype lives in git history only (`git show 8a9e9a2` and earlier).

The reference design doc (product decisions, review reports, spike verdicts) lives at `~/.gstack/projects/t3hx-myPortfolio/tehx-fix-rendering-design-20260804-174239.md`. The interaction spec for the scene is `docs/PORTFOLIO_3D_INTERACTIONS.md` — **read it before touching scene behavior**; it lists every animation/interaction with exact object names.

### The asset (IMPORTANT — changed 2026-07-20)

`public/models/scene.glb` is a copy of `portfolio_final.glb` (~90 MB, 145 meshes, ~192 MB texture VRAM, main atlas 4096²). It is **entirely pre-baked unlit**:

- **No lights, no cameras, no animations in the file.** All lighting + AgX tone mapping is cooked into the textures.
- The baked image of each material lives in its **emissive texture slot**.
- Every mesh carries a **`runtime` tag** in glTF extras (`userData.runtime`, on the node OR a parent): `unlit` (93) / `emissive` (27) / `glass` (1, the PC case pane) / `decal` (1, the amp's Sharmall logo).
- The `.glb` is gitignored — Blender is the source of truth. Copy it into any fresh worktree.

### Render pipeline (`src/config/renderPipeline.ts` + `src/scene/RoomModel.tsx`)

WYSIWYG rule: what Blender shows is what WebGL must show. `RoomModel` traverses the scene and rebuilds every material as `MeshBasicMaterial` from its `runtime` tag (map = the emissive slot, DoubleSide; glass → transparent 0.28 no-depth-write; decal → alphaTest 0.5). The renderer runs `NoToneMapping` + sRGB, zero lights, zero shadows. **Never add lights or runtime tone mapping** — if colors look wrong, the bake is wrong, fix it in Blender. This replaced the legacy `blenderMatch.ts` calibration system (git history) which belonged to the old lit export.

### Camera stops (`src/config/stopPoses.ts` + `src/lib/stops.ts`)

The current export has **no cameras**, so the 10 stop poses (position / quaternion / **per-stop fov** — 32.3° standard, 4.3° telescope-moon zoom, 53.7° guitar wide) are hardcoded in `STOP_POSES`, sampled from the legacy export which still had real Blender cameras. `orderedStops()` prefers glb-extracted cameras when present, falls back to the table — so re-adding `CameraStop_*` cameras to a future export just works. Stop order + labels: `src/config/cameraStops.ts` (order = tour order = `?stop=` keys).

### Navigation model (user-validated — do not regress to scrubbing)

One scroll gesture = ONE fluid stroke to the next/previous stop (fullpage model), driven by a single GSAP tween (`power3.inOut`, 1.2 s). See `src/scene/CameraRig.tsx`:

- The wheel is **owned** (`preventDefault`, Lenis-style): deltas feed a clock-free gesture detector — momentum decays and never reverses, so fresh intent = direction change or a delta exceeding the gesture's peak; gestures re-arm on stroke completion (held scroll chains stop by stop, a flick moves exactly one).
- Any post-gesture "settle" movement was explicitly rejected by the user — never reintroduce scrub+snap.
- Feel knobs at the top of CameraRig: `STEP_DURATION`, `STEP_EASE`, `GESTURE_THRESHOLD_PX`, `MIN_COUNTED_DELTA`, `TAIL_GUARD_RATIO`. Dev probes: `window.__rigDebug`, `window.__wheelLog`.

### Interaction state machine (`src/state/interaction.ts`, zustand)

`TOURING ⇄ PARKED → PANEL_OPEN | TELESCOPE`. Each phase owns one input routing: panels capture their own wheel (the rig ignores events targeting `.panel`), TELESCOPE runs an imperative camera excursion to the moon and swaps `Outside_Moon` ↔ `Outside_Moon_Detailed` visibility (RoomModel subscription). Escape exits panel/telescope. The full interaction backlog (fans, smoke, NanoLeaf shader, cat pupils, curtains, drawers) is specced in `docs/PORTFOLIO_3D_INTERACTIONS.md`.

### Outlines (`src/scene/Outlines.tsx` + `src/config/lineArt.ts`)

Runtime 2.5D ink, URL-toggled: `?outline=off|hull|edges|both` (+ `?lw=<px>` live width). `hull` = three OutlineEffect (batched inverted hull, view-dependent silhouettes — takes over rendering via a priority useFrame). `edges` = per-mesh `EdgesGeometry` rendered as screen-space fat lines (`LineSegments2`), with `LINE_OVERRIDES` per-object exclusions. Known drei/browser gotchas are commented in the code — read them before refactoring (Html portals, z-index ranges).

### URL parameters (dev tooling — keep working)

- `?stop=<label>` — deterministic camera snap (render-comparison loop + shareable links)
- `?outline=`, `?lw=` — ink A/B and width
- `?debug`, `?debug-fly` — view modes (fly mode not yet ported to R3F)

## Conventions

- Path alias `@/` → `src/` (in `vite.config.ts` and `tsconfig.json`).
- The render camera's initial pose in `App.tsx` seeds the Home stop from `STOP_POSES` so frame 0 isn't at the origin.
- All positions in `docs/PORTFOLIO_3D_INTERACTIONS.md` are **Blender Z-up** coordinates: convert with `(x, z, -y)` before runtime use.
- Loading budget (measured 2026-08-05): the 90 MB export compresses to **6.8 MB with webp alone, 2.0 MB with draco+webp** (`pnpm dlx @gltf-transform/cli webp` then `draco`) — verify webp banding on the baked lightmaps before shipping. Texture VRAM stays ~192 MB regardless: KTX2 (CI-side, needs KTX-Software) is mandatory for mobile.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
