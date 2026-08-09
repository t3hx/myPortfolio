# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`).

- `pnpm dev` — Vite dev server with HMR.
- `pnpm build` — production build to `dist/` (does **not** type-check; run `type-check` separately).
- `pnpm type-check` — `tsc --noEmit`.
- `pnpm preview` — serve the production build locally.
- `pnpm test` — Vitest, single run. `pnpm test:watch` for the loop.

`tsconfig.json` includes `tests` and both config files, so `type-check` covers them too — it did not before, and a green type-check said nothing about the tests.

No linter and no formatter yet (issue #21). Playwright and the render-comparison loop are issue #22.

## Architecture

This is a **React 19 + react-three-fiber v9** single-page portfolio that renders a Blender-authored room and runs a stop-to-stop camera tour. It began as the "scroll spike" of the rebuild (branch `feat/spike-scroll-r3f`) and is the skeleton the full product grows from. The previous Vue 3 + TresJS prototype lives in git history only (`git show 8a9e9a2` and earlier).

The reference design doc (product decisions, review reports, spike verdicts) lives at `~/.gstack/projects/t3hx-myPortfolio/tehx-fix-rendering-design-20260804-174239.md`. The interaction spec for the scene is `docs/PORTFOLIO_3D_INTERACTIONS.md` — **read it before touching scene behavior**; it lists every animation/interaction with exact object names.

### The asset (IMPORTANT — currently `docs/portfolio_v12.glb`, 2026-08-09)

`public/models/scene.glb` is a copy of the latest export. Blender is the source of truth and the `.glb` is gitignored — copy it into any fresh worktree. Current export: **3.0 MB, 146 meshes, 124 materials, 14 textures, ~162 MB texture VRAM**. It is **entirely pre-baked unlit**:

- **No lights and no animations in the file.** All lighting + AgX tone mapping is cooked into the textures.
- The baked image of each material lives in its **emissive texture slot** (100 of the 124 materials have one). Any other slot is dead weight: an unlit pipeline ignores normal/AO/roughness maps.
- **11 `CameraStop_*` cameras**, each carrying its own focal length — the tour's single source of truth (see below).
- Compression: **Draco geometry + webp textures** (`KHR_draco_mesh_compression`, `EXT_texture_webp`). 90 MB of PNG/raw → 7.6 MB webp → 3.0 MB with Draco; geometry was ~5.4 MB of that. Draco needs the decoder in `public/draco/` (see `DRACO_DECODER_PATH`).
- **No `runtime` tags** (dropped in v10). `RoomModel` therefore *derives* each material's treatment from the glTF itself — see below. Tags are still read first if a future export restores them.
- Texture VRAM is the real mobile risk and compression does **not** reduce it: KTX2 in CI is still required.

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

### Camera stops (`src/config/cameraStops.ts` + `src/lib/stops.ts`)

**Blender is the single source of truth for poses AND focal lengths.** `extractStops()` samples each `CameraStop_*` node's world transform straight from the loaded graph (no Z-up→Y-up conversion to get wrong); the glb's cameras are never made active, we tween *our* render camera to match.

**Field of view is stored HORIZONTALLY — do not "simplify" this.** A glTF camera describes its framing as `yfov` **+ `aspectRatio`**, and Blender derives that pair from the scene's render resolution: the v12 export declares `aspectRatio: 1`, so its `yfov` is the field of a *square* frame (Home: 54.43°), not the vertical field of a widescreen one. Feeding it straight into three's `camera.fov` (vertical, against the canvas aspect) frames everything far too wide — it visibly broke the Home reveal. The horizontal field is the invariant: 54.43° horizontal = 32.27° vertical at 16:9, exactly what the previous export declared for the same camera. `applyProgress()` interpolates the horizontal field and converts it per viewport via `verticalFov()` — a **horizontal fit**, so Blender's framing survives every screen ratio and a shorter viewport crops top/bottom instead of pulling back and losing the shot.

Adding a stop = name a camera `CameraStop_<X>` in Blender **+** add one line to `CAMERA_STOPS` (the array *is* the tour order, and its `label` is the `?stop=` key). A stop listed in code but missing from the glb is skipped with a console warning.

There is deliberately **no hardcoded pose table** any more: it existed only while an export shipped without cameras, and two sources of truth for the same thing is a bug waiting to happen.

**The `Home` framing is deliberate** (product decision): it fills the frame with a monitor so the first screen reads as a flat 2D image; the first scroll pulls back and reveals the room in 3D. That reveal is the opening beat of the experience — never "fix" Home into a room overview.

**All 11 stops come from the glb — verified 2026-08-09.** Every `CameraStop_*` node carries a real camera with its own authored focal length (Bookshelf 73.74° hfov ≈ 24 mm, MonitorVertical 38.19° ≈ 52 mm, TelescopeMoon 7.63° ≈ 270 mm). An earlier note here claimed the export lacked the bookshelf and second-monitor framings and told you to add them to a `STOP_POSES` table — both were wrong: v12 provides them, and that table was deliberately deleted. Design-doc tasks T6 and T7 predate the v12 export and are obsolete.

A node named `CameraStop_X` that carries **no** camera (an Empty) is now skipped with an explicit warning. It used to fall through to `fov = 45`: the stop parked at the right spot, said nothing, and showed a framing nobody authored — plausible enough to read as a Blender decision. `tests/stops.test.ts` locks both this and the horizontal-fov derivation; the two are the only regressions this file has ever shipped, and neither was visible to the eye.

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
- No initial camera pose is seeded in `App.tsx`: `<Suspense>` holds the first frame until the .glb is parsed, and `CameraRig` places the camera from the glb's own cameras on the frame after. Nothing ever renders at the origin, so there is no pose to hardcode.
- All positions in `docs/PORTFOLIO_3D_INTERACTIONS.md` are **Blender Z-up** coordinates: convert with `(x, z, -y)` before runtime use.
- Loading budget (measured 2026-08-05): the 90 MB export compresses to **6.8 MB with webp alone, 2.0 MB with draco+webp** (`pnpm dlx @gltf-transform/cli webp` then `draco`) — verify webp banding on the baked lightmaps before shipping. Texture VRAM stays ~192 MB regardless: KTX2 (CI-side, needs KTX-Software) is mandatory for mobile.

## The backlog is the plan (not the design doc)

The build plan lives in **GitHub issues #10+ and Project 4**, not in the design doc — whose Implementation Tasks predate the v12 export and are partly stale (T3–T7: some already shipped, some obsolete). **Verify against the code before starting anything sourced from that doc.**

Creating an issue has four mandatory steps — numbered title, labels **and** Project fields, native sub-issues, populated body. They are spelled out in **`docs/CONVENTION_GITHUB.md`**; read that section before opening issues, and note that a `size:L` label and the Project's `Size` field are two different things that must both be set.

**Every PR carries `Closes #N` in its body** (footer, never the title — the title is a conventional commit). Merging then closes the issue, the Project's "Item closed" automation moves it to `✅ done`, and a parent EPIC's sub-issue counter advances on its own. A PR that cannot honestly claim `Closes` is a PR whose issue needed splitting.

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
