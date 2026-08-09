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

### The asset (IMPORTANT — currently `docs/portfolio_v10.glb`, 2026-08-09)

`public/models/scene.glb` is a copy of the latest export. Blender is the source of truth and the `.glb` is gitignored — copy it into any fresh worktree. Current export: **7.6 MB, 146 meshes, 124 materials, 15 textures, ~173 MB texture VRAM**. It is **entirely pre-baked unlit**:

- **No lights, no cameras, no animations in the file.** All lighting + AgX tone mapping is cooked into the textures.
- The baked image of each material lives in its **emissive texture slot** (100 of the 124 materials have one).
- Textures ship as **webp** (`EXT_texture_webp`, supported natively by three's GLTFLoader) — hence 7.6 MB where the previous PNG export weighed 90 MB. Main atlas `bake_atlas_2048_agx` is 2048² (was 4096²).
- **No `runtime` tags any more** (v10 dropped the custom properties). `RoomModel` therefore *derives* each material's treatment from the glTF itself — see below. Tags are still read first if a future export restores them.

### Render pipeline (`src/config/renderPipeline.ts` + `src/scene/RoomModel.tsx`)

WYSIWYG rule: what Blender shows is what WebGL must show. `RoomModel` traverses the scene and rebuilds every material as `MeshBasicMaterial`, choosing the treatment per material (not per mesh — merged meshes mix baked surfaces with emitters):

| Condition | Treatment |
|---|---|
| alpha-blended, no texture | **glass** — transparent at the authored alpha, no depth write (PC case pane) |
| alpha-blended/masked + texture | **decal** — alphaTest 0.5, no depth write (amp's Sharmall logo) |
| no texture, emissive non-black | **emissive** — colour = `emissive × emissiveIntensity` (fans, LEDs, bulbs, cat eyes, keyboard backlight…) |
| anything else | **unlit** — the baked emissive texture as `map` |

Folding `emissiveIntensity` into the colour is load-bearing: `KHR_materials_emissive_strength` reaches ×5 on the bulbs, and an unlit material has no emissive channel to carry it. The renderer runs `NoToneMapping` + sRGB, zero lights, zero shadows. **Never add lights, a runtime tone mapping, or an `<Environment>`** — `MeshBasicMaterial` is unlit by definition and ignores environment lighting; if something renders black, it is a *material treatment* bug in the table above, not a missing light.

This replaced the legacy `blenderMatch.ts` calibration system (git history), which belonged to the old lit export. If colors look wrong, the bake is wrong — fix it in Blender.

### Camera stops (`src/config/stopPoses.ts` + `src/lib/stops.ts`)

The current export has **no cameras**, so the 10 stop poses (position / quaternion / **per-stop fov** — 32.3° standard, 4.3° telescope-moon zoom, 53.7° guitar wide) are hardcoded in `STOP_POSES`, sampled from the legacy export which still had real Blender cameras. `orderedStops()` prefers glb-extracted cameras when present, falls back to the table — so re-adding `CameraStop_*` cameras to a future export just works. Stop order + labels: `src/config/cameraStops.ts` (order = tour order = `?stop=` keys).

**The `Home` framing is deliberate** (product decision): it fills the frame with a monitor so the first screen reads as a flat 2D image; the first scroll pulls back and reveals the room in 3D. That reveal is the opening beat of the experience — never "fix" Home into a room overview.

**Stops can be authored in code.** The tour needs two framings the export doesn't provide — the bookshelf and the second monitor (the CV beat). Add them to `CAMERA_STOPS` (order/label) and `STOP_POSES` (pose), same as any glb-provided stop; see the backlog in the design doc.

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
