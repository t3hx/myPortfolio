# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **pnpm** (see `pnpm-lock.yaml`).

- `pnpm dev` — Vite dev server with HMR.
- `pnpm build` — production build to `dist/` (does **not** type-check; run `type-check` separately).
- `pnpm type-check` — `tsc --noEmit`.
- `pnpm preview` — serve the production build locally.
- `pnpm test` — Vitest, single run. `pnpm test:watch` for the loop.
- `pnpm test:e2e` — Playwright: the render-comparison loop (11 stops vs `docs/renders/refs/`). **Distinct from `test` on purpose** — Vitest's `include` only takes `tests/**/*.test.ts`, the Playwright specs are `.spec.ts` under `tests/e2e/`. Needs `pnpm exec playwright install chromium` once.

`tsconfig.json` includes `tests` and both config files, so `type-check` covers them too — it did not before, and a green type-check said nothing about the tests.

- `pnpm lint` — ESLint **and** `prettier --check`. This is the script CI calls (`pnpm run --if-present lint`), so both must pass.
- `pnpm format` — `prettier --write` then `eslint --fix`.

The render-comparison loop shipped with #44/#45/#46 — see **`docs/renders/README.md`**, which holds the measured tolerance and the two known deviations. Three things about it are load-bearing:

- **It reads the WebGL drawing buffer** (`canvas.toDataURL()`), it does not screenshot the page. The references are bare Blender renders; a page capture would carry the bubble, the menu bar and the CV, and the measured drift would be dominated by DOM nobody meant to compare — every new 2D element skewing it a little further, in silence. It also sidesteps Playwright's stability wait, which R3F's endless `rAF` loop never satisfies (that is the 5 s timeout noted on 2026-08-09).
- **`?capture` exists only to turn on `preserveDrawingBuffer`.** Without it the image is black; permanently on, it costs a buffer copy per frame.
- **The capture format must equal the references' format.** They are **1920×1080** since their 2026-08-20 re-shoot; the harness captures at exactly that. The _ratio_ is what fixes the framing (the tour fits its field horizontally), the _resolution_ is what lets the comparison happen at all — a mismatch fails on dimensions instead of comparing. And three references are named after their Blender camera node or in French rather than after the stop's `label`, so the mapping is declared once in `REF_FILE`: `label` owns the `?stop=` deep links, the filename follows the Blender export, and renaming either to "simplify" breaks the other.
- **Both environments rasterise with SwiftShader** (`--enable-unsafe-swiftshader --use-gl=angle --use-angle=swiftshader`). No GitHub runner has a GPU, and a tolerance measured locally would mean nothing if CI antialiased differently.

CI runs it in its own workflow, `.github/workflows/render-diff.yml`: `ci.yml` is copied byte-for-byte across the three repos and must not learn about a 3D scene.

### Two TypeScripts, on purpose (issue #21)

`package.json` looks wrong at a glance and is not:

```json
"@typescript/native": "npm:typescript@^7.0.2",
"typescript": "npm:@typescript/typescript6@^6.0.2"
```

TypeScript 7 is the **native (Go) port**: its npm package ships a binary and _no JavaScript compiler API_ — `ts.createSourceFile` and `ts.createProgram` are `undefined`. typescript-eslint needs that API, imports it from the bare name `typescript` as a peer dependency, and refuses to load at all against v7 (it throws by name: _"typescript-eslint does not support TS 7.0"_). No release of it supports v7, canary included.

This is the side-by-side layout Microsoft documents for exactly this case: the **name** `typescript` resolves to the v6 package (the JS API, for tooling), while the native v7 compiler keeps the `tsc` binary under an alias. Verified after a `--frozen-lockfile` install: `.bin/tsc` is 7.0.2, `.bin/tsc6` is the v6 one, and `require('typescript')` gives 6.0.3 with a working API. So `pnpm type-check` still runs the fast native compiler; only the linter and your editor's LSP read the v6 API. `pnpm overrides` cannot do this job — `typescript` is a _peer_ dependency and resolves from the root either way.

The lint rules are deliberately **not** type-aware (`tseslint.configs.recommended`, not `recommendedTypeChecked`): pointing a second compiler version at the same `tsconfig.json` invites a silent gap between what `tsc` sees and what the linter believes. `pnpm type-check` stays the authority on types.

`eslint-plugin-react-hooks@7` ships the sixteen **React Compiler** rules in its `recommended` preset, and this repo enables only `rules-of-hooks` and `exhaustive-deps` from it. The compiler rules model pure React data flow; this app is an imperative react-three-fiber shell, where mutating a three.js material from an effect (`Outlines.tsx`) is the normal pattern, not a fault — and `set-state-in-effect` condemns the deferred unmount validated in #47. Adopting the React Compiler is a decision of its own, not a side effect of adding a linter.

`docs/design/` is excluded from both tools: the mockups document committed captures, and `tokens.css` is written in the compact style the design session reviewed.

## Architecture

This is a **React 19 + react-three-fiber v9** single-page portfolio that renders a Blender-authored room and runs a stop-to-stop camera tour. It began as the "scroll spike" of the rebuild (branch `feat/spike-scroll-r3f`) and is the skeleton the full product grows from. The previous Vue 3 + TresJS prototype lives in git history only (`git show 8a9e9a2` and earlier).

The reference design doc (product decisions, review reports, spike verdicts) lives at `~/.gstack/projects/t3hx-myPortfolio/tehx-fix-rendering-design-20260804-174239.md`. The interaction spec for the scene is `docs/PORTFOLIO_3D_INTERACTIONS.md` — **read it before touching scene behavior**; it lists every animation/interaction with exact object names.

### The 2D UI design system (`docs/design/`)

Output of the Claude Design session (2026-08-10), and the single source of truth for everything the DOM draws on top of the canvas — **read it before building any 2D UI**:

- `docs/design/DESIGN.md` — direction ("Lueur": smoked glass + cold glow), tokens, bubble/menu anatomy, the **per-stop placement table**, motion budgets, and the implementation notes that were verified in a browser.
- `docs/design/tokens.css` — the custom properties plus working `.bubble` / `.menu` components. Tokens, not utility classes.
- `docs/design/screens/*.html` — 15 standalone reference screens (11 stops + preselection + preloader + the project sheet and the empty drawer, added by #78), high-fidelity. Open them directly; they are prototypes to **recreate** in R3F, not code to paste.

Their backgrounds are the committed `docs/renders/refs/*.png` — the same renders the comparison loop uses, so re-shooting a stop updates the mockups for free. The design session worked on 1920×1080 exports of those same framings; a second copy was deliberately not committed.

The UI is **two components only** — a vertical menu bar on the right edge and one text bubble per stop, anchored to the framed object. The 3D is the interface; the UI must not compete with it.

### The asset (IMPORTANT — currently `docs/portfolio_v13.glb`, 2026-08-10)

`public/models/scene.glb` is a copy of the latest export. Blender is the source of truth and the `.glb` is gitignored — copy it into any fresh worktree. Current export: **3.0 MB, 146 meshes, 124 materials, 14 textures, ~162 MB texture VRAM**. It is **entirely pre-baked unlit**:

- **No lights and no animations in the file.** All lighting + AgX tone mapping is cooked into the textures.
- The baked image of each material lives in its **emissive texture slot** (100 of the 124 materials have one). Any other slot is dead weight: an unlit pipeline ignores normal/AO/roughness maps.
- **11 `CameraStop_*` cameras**, each carrying its own focal length — the tour's single source of truth (see below). v13 also declares `aspectRatio: 16/9`, which v12 did not.
- Compression: **Draco geometry + webp textures** (`KHR_draco_mesh_compression`, `EXT_texture_webp`). 90 MB of PNG/raw → 7.6 MB webp → 3.0 MB with Draco; geometry was ~5.4 MB of that. Draco needs the decoder in `public/draco/` (see `DRACO_DECODER_PATH`).
- **No `runtime` tags** (dropped in v10). `RoomModel` therefore _derives_ each material's treatment from the glTF itself — see below. Tags are still read first if a future export restores them.
- Texture VRAM is the real mobile risk and compression does **not** reduce it: KTX2 in CI is still required.

### Render pipeline (`src/config/renderPipeline.ts` + `src/scene/RoomModel.tsx`)

WYSIWYG rule: what Blender shows is what WebGL must show. `RoomModel` traverses the scene and rebuilds every material as `MeshBasicMaterial`, choosing the treatment per material (not per mesh — merged meshes mix baked surfaces with emitters):

| Condition                      | Treatment                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| alpha-blended, no texture      | **glass** — transparent at the authored alpha, no depth write (PC case pane)                              |
| alpha-blended/masked + texture | **decal** — alphaTest 0.5, no depth write (amp's Sharmall logo)                                           |
| no texture, emissive non-black | **emissive** — colour = `emissive × emissiveIntensity` (fans, LEDs, bulbs, cat eyes, keyboard backlight…) |
| anything else                  | **unlit** — the baked emissive texture as `map`                                                           |

Folding `emissiveIntensity` into the colour is load-bearing: `KHR_materials_emissive_strength` reaches ×5 on the bulbs, and an unlit material has no emissive channel to carry it. The renderer runs `NoToneMapping` + sRGB, zero lights, zero shadows. **Never add lights, a runtime tone mapping, or an `<Environment>`** — `MeshBasicMaterial` is unlit by definition and ignores environment lighting; if something renders black, it is a _material treatment_ bug in the table above, not a missing light.

This replaced the legacy `blenderMatch.ts` calibration system (git history), which belonged to the old lit export. If colors look wrong, the bake is wrong — fix it in Blender.

### Camera stops (`src/config/cameraStops.ts` + `src/lib/stops.ts`)

**Blender is the single source of truth for poses AND focal lengths.** `extractStops()` samples each `CameraStop_*` node's world transform straight from the loaded graph (no Z-up→Y-up conversion to get wrong); the glb's cameras are never made active, we tween _our_ render camera to match.

**Field of view is stored HORIZONTALLY — do not "simplify" this.** A glTF camera describes its framing as `yfov` **+ `aspectRatio`**, and Blender derives that pair from the scene's render resolution. The horizontal field is the invariant: `extractStops()` computes it from _both_ numbers, `applyProgress()` interpolates it, and `verticalFov()` converts it per viewport — a **horizontal fit**, so Blender's framing survives every screen ratio and a shorter viewport crops top/bottom instead of pulling back and losing the shot.

**v13 made this trap harder to catch, not easier.** v12 declared `aspectRatio: 1` — a square frame — so feeding its `yfov` straight into three's `camera.fov` framed everything far too wide and visibly broke the Home reveal. v13 declares 16:9, so the same shortcut now looks _correct on a 16:9 viewport_ and only drifts on other ratios: an ultrawide monitor or a laptop at 16:10 would quietly get a framing nobody authored. The derivation is still load-bearing; it just no longer fails loudly. `tests/stops.test.ts` is what keeps it honest.

Adding a stop = name a camera `CameraStop_<X>` in Blender **+** add one line to `CAMERA_STOPS` (the array _is_ the tour order, and its `label` is the `?stop=` key). A stop listed in code but missing from the glb is skipped with a console warning.

There is deliberately **no hardcoded pose table** any more: it existed only while an export shipped without cameras, and two sources of truth for the same thing is a bug waiting to happen.

**The `Home` framing is deliberate** (product decision): it fills the frame with a monitor so the first screen reads as a flat 2D image; the first scroll pulls back and reveals the room in 3D. That reveal is the opening beat of the experience — never "fix" Home into a room overview.

**All 11 stops come from the glb — re-verified against v13, 2026-08-10.** Every `CameraStop_*` node carries a real camera with its own authored focal length, spanning GuitarPoster 83.97° hfov (≈ 20 mm) to TelescopeMoon 7.63° (≈ 270 mm). **Four framings changed between v12 and v13** — Bookshelf 73.74° → 49.55°, MonitorVertical 38.19° → 26.99°, Scoreboard 61.93° → 55.79°, Home 54.43° → 53.13° — which is why every reference render was re-shot. Nothing in the code changed: deriving the horizontal field from `yfov × aspectRatio` absorbed both the new focals and the new aspect ratio on its own. An earlier note here claimed the export lacked the bookshelf and second-monitor framings and told you to add them to a `STOP_POSES` table — both were wrong, and that table was deliberately deleted. Design-doc tasks T6 and T7 are obsolete.

A node named `CameraStop_X` that carries **no** camera (an Empty) is now skipped with an explicit warning. It used to fall through to `fov = 45`: the stop parked at the right spot, said nothing, and showed a framing nobody authored — plausible enough to read as a Blender decision. `tests/stops.test.ts` locks both this and the horizontal-fov derivation; the two are the only regressions this file has ever shipped, and neither was visible to the eye.

### Navigation model (user-validated — do not regress to scrubbing)

One scroll gesture = ONE fluid stroke to the next/previous stop (fullpage model), driven by a single GSAP tween (`power3.inOut`, 1.2 s). See `src/scene/CameraRig.tsx`:

- The wheel is **owned** (`preventDefault`, Lenis-style): deltas feed a clock-free gesture detector — momentum decays and never reverses, so fresh intent = direction change or a delta exceeding the gesture's peak; gestures re-arm on stroke completion (held scroll chains stop by stop, a flick moves exactly one).
- Any post-gesture "settle" movement was explicitly rejected by the user — never reintroduce scrub+snap.
- Feel knobs at the top of CameraRig: `STEP_DURATION`, `STEP_EASE`, `GESTURE_THRESHOLD_PX`, `MIN_COUNTED_DELTA`, `TAIL_GUARD_RATIO`. Dev probes: `window.__rigDebug`, `window.__wheelLog`.

### Interaction state machine (`src/state/interaction.ts`, zustand)

`TOURING ⇄ PARKED → PANEL_OPEN | TELESCOPE`. Each phase owns one input routing: panels capture their own wheel (the rig ignores events targeting `.panel`), TELESCOPE runs an imperative camera excursion to the moon and swaps `Outside_Moon` ↔ `Outside_Moon_Detailed` visibility (RoomModel subscription). Escape exits panel/telescope. The full interaction backlog (fans, smoke, NanoLeaf shader, cat pupils, curtains, drawers) is specced in `docs/PORTFOLIO_3D_INTERACTIONS.md`.

### The cat is alive (`src/scene/CatAlive.tsx` + `src/lib/cat.ts` + `src/config/cat.ts`)

Issue #37: the pupils follow the cursor, the tail sways, the eyes blink. Everything is a **transform** — no material is touched, so none of it can threaten the WYSIWYG-with-Blender rule.

- **Offsets are computed in the cat's frame, never the world's.** The `.glb` graph is flat (157 nodes, all scene roots) and every cat part carries the same rotation, ~52° about Y. Offsetting along world axes would slide the pupil sideways across the eye and wave the tail in the wrong direction.
- **The tail is translated, not rotated.** The six `Cat_TailSeg_*` are siblings, each pivoting on its own centre rather than on a joint — rotating them would pull them apart. They are displaced perpendicular to the tail, with the amplitude growing toward the tip and a per-segment phase offset, which is what makes it a wave instead of a block sliding sideways.
- **There is no eyelid in the `.glb`**, so the blink squashes eye, pupil and highlight vertically. They share a height to within 3 mm, so squashing each about its own centre is invisible — and cheaper than building a runtime group for three objects.
- **The eye radius is measured at runtime** from the bounding box, and the pupil travel is a _fraction_ of it. The spec proposed absolute units; a re-export that rescales the cat would make a hardcoded number wrong in silence.
- **`prefers-reduced-motion` cuts everything, pupils included.** Keeping the gaze looked defensible under the design system's "gesture-triggered motion survives" rule, but it is the wrong side of it: an element that chases the cursor moves on every mouse movement, for any reason, which is exactly what motion-sensitive users object to. A hover that lights a halo answers an intention; a pupil that follows does not.

**The render-comparison loop forces reduced motion in `captureStop`, with an explicit `page.emulateMedia`** — not through `playwright.config.ts`. The config option was tried first and **did not reach the page**: measured, `matchMedia` answered `false` there while `viewport`, sitting right beside it, applied. The cat's tail was therefore still swinging during captures, under tolerance and with nothing to say so; two consecutive desk captures differed by 10 454 pixels, all of them on the PC case. Forcing it explicitly is what keeps the loop deterministic now that the scene animates. Two reasons, the second being the real one: an autonomous animation makes the capture depend on _when_ it is taken, and the Blender references show the room **at rest** — exactly the state reduced motion produces. `tests/cat.test.ts` locks the guard as the first statement of the frame loop; moving it below the gaze re-introduced a run-to-run drift of 0.288 % then 0.255 % on the cat stop.

### The desk breathes (`src/scene/DeskAlive.tsx` + `src/lib/desk.ts` + `src/config/desk.ts`)

Issue #35: the ten case fans turn, the mug steams.

- **A fan's axis is derived, not written down.** A fan is a disc, so its thinnest dimension _is_ its axis — measured on the export: `0.0951 × 0.0149 × 0.0951` for the top and bottom faces, `0.14 × 0.14 × 0.0125` for the rear, `0.0149 × 0.0951 × 0.0951` for the right side. Deriving it covers all ten at once and survives a re-export that reorients the case; the spec listed the three orientations by hand, which is right today and wrong the day a fan is added.
- **Only the blades turn.** Each fan is a two-primitive mesh — `Mat_FanFrame` (144 indices, the round housing) and `Mat_FanBlade` (78, the blades) — that the glTF loader mounts as two sibling `Mesh`es. Rotating the parent took the housing with it, and a fan housing is bolted to the case. The material name survives the rebuild (`RoomModel` copies `src.name`), so that is what tells them apart.
- **Speeds are desynchronised; the direction is the same for all of them.** It alternated at first, to "break the block effect" — a designer's idea applied to mechanics: in a real case every fan is mounted the same way, and what varies is the speed. Measured on the rear fan by correlating the angular brightness profile across two frames: `FAN_SPIN = -1` reads **clockwise** on screen.
- **The smoke is added geometry, never a rebuilt baked material** — that is what keeps it compatible with the unlit pipeline. A `Points` cloud with its own shader; the soft disc is drawn from `gl_PointCoord` rather than loaded as a texture.
- **What makes smoke is size and falloff, not opacity.** Calibrated in three measured passes. At 22 puffs of 15–54 px they never touched: isolated white dots, i.e. dust. At 190 px they merged into a fog patch three times wider than the mug. 120 puffs of 26–78 px, very faint, read as a rising filament. The falloff is **gaussian, not polynomial**: a power of `1 - d` dies with a non-zero slope, so each disc keeps an edge, and fifty stacked edges read as grain — a gaussian has no edge at all, only a density that decays, which is what lets puffs dissolve into one another.
- **Reduced motion cuts the loop _and_ unmounts the smoke.** Freezing is not enough for it: frozen puffs stay **visible**, and the Blender references contain none.

### The telescope viewfinder (`src/ui/TelescopeScope.tsx`)

Issue #106, and the last interaction `docs/PORTFOLIO_3D_INTERACTIONS.md` specified without an issue. Clicking the telescope already flew the camera to the moon and swapped `Outside_Moon` → `Outside_Moon_Detailed`; nothing said you were looking _through_ anything. This circular mask is the difference between a camera that moved and an eyepiece.

- **A radial gradient in the DOM, not a second render pass.** The spec allowed either. The DOM wins because the scene is a baked unlit render we do not touch, and an extra pass would be a permanent GPU cost for what is only a gradient.
- **It is not modal.** At `--z-bubble` (100) it sits _under_ the menu bar; at `--z-panel` it would cover it and `Escape` would become the only way out. Same call as the CV.
- **The reticle is sized on viewport WIDTH, never `min(vw, vh)`.** Same reason as the bubbles: the tour fits its field horizontally, so the moon's apparent radius is proportional to the frame's width and nothing else. On `min()` the reticle tracked the moon near 16:9 and drifted everywhere else — measured, it landed at 0.95 of the limb and cut across the moon's face. `--scope-moon` is the moon's measured apparent radius (0.25 × 100vw), and every rim decoration is a multiple of it, never below 1; `tests/scope.test.ts` fails if one drifts inside.
- **The excursion is in TWO stages, and the viewfinder opens between them.** One flight took the camera _through_ the instrument to a 270 mm close-up of the moon, with nothing saying a telescope stood in between. Stage one comes to rest behind the eyepiece with the instrument filling the frame; the viewfinder opens there; stage two only changes the field, **inside** the mask — that is magnification, not travel. The eyepiece pose needs no new Blender data: `CameraStop_TelescopeMoon` already sits 58 cm from the telescope, so backing along its axis is enough.
- **The excursion widens the final field (`TELESCOPE_FOV_PAD`), the tour does not.** The `Moon` stop frames the moon edge to edge — Blender's decision, untouched. But inside a viewfinder a moon that touches the rim never shows that you are looking _through_ something: it needs sky around it and room for the mask. Changing this factor invalidates `--scope-moon`, which is the moon's **measured** apparent radius _in the viewfinder_.
- **It opens on ARRIVAL, not on click.** `phase === 'telescope'` flips the moment you click, while the camera takes 1.6 s to reach the eyepiece — opening then laid the mask over a room still in motion. `CameraRig`'s excursion calls `settleTelescope()` in its `onComplete`, and the viewfinder reads `telescopeSettled`.
- **The hover is decided by one raycast per pointer move, never by `onPointerOver`/`onPointerOut`.** Placed on the whole scene, those fire for _every_ mesh crossed: entering the telescope lit the outline, then a late `pointerOut` from a neighbouring object put it out — and the reverse. Measured: an outline that failed to light when it should, and lit when the cursor was elsewhere. A ray pairs with nothing — ask what is hit first, light up if it is the telescope. The flag also clears in `enterTelescope`, because after the click the mouse stops moving and the outline otherwise stayed lit across the whole flight.
- **The hover flag travels through the store rather than a second `<primitive>`**: rendering the same `Object3D` twice would **reparent** it out of the scene `RoomModel` owns.
- **`Telescope_Merged` is a three-primitive mesh**, so the loader names its children `Telescope_Merged_1/_2/_3` and a raycast never returns the group. Strict name equality recognises nothing — measured, it broke the click _and_ the hover at once, silently. `isTelescope()` matches the prefix, with its `_`.
- **The reticle is four ticks at the rim, never a crosshair at the centre** — the centre is the moon, and you do not strike it through.
- **The aperture closes by scaling the whole mask, not the radius.** A custom property does not interpolate in `@keyframes` without `@property`; it would jump. Scaled up, the mask overflows the frame, so the black still covers the screen while the hole closes.

### Outlines (`src/scene/Outlines.tsx` + `src/config/lineArt.ts`)

Runtime 2.5D ink, URL-toggled: `?outline=off|hull|edges|both` (+ `?lw=<px>` live width). `hull` = three OutlineEffect (batched inverted hull, view-dependent silhouettes — takes over rendering via a priority useFrame). `edges` = per-mesh `EdgesGeometry` rendered as screen-space fat lines (`LineSegments2`), with `LINE_OVERRIDES` per-object exclusions. Known drei/browser gotchas are commented in the code — read them before refactoring (Html portals, z-index ranges).

### The narrative bubble (`src/scene/Bubble.tsx`)

The design system's `.bubble` made real (issue #47): a drei `<Html>` re-projects a world-space `anchor` every frame, so the bubble tracks the framed object through camera moves. Two things are load-bearing and commented in the file — the **explicit `portal` prop to App3D's `.bubble-layer`** (without it drei portals into the canvas container and the bubble inherits its stacking context) and the **hardcoded capped `zIndexRange`** (drei's default reaches ~16 million and would paint bubbles above the HUD at 200 and the panel at 300; the layer's z 100 fixes the floor). Prop contract: `visible` drives a 200 ms fade-then-unmount exit, omitting `kicker` switches the markup to the home "inline" variant, and `maxWidth` / `tick` / `tilt` / `className` carry the per-stop design variants. The CSS is split on purpose: anatomy and entry motion live in `docs/design/tokens.css`; `src/styles.css` adds only the projected-layer overrides (`.bubble-layer .bubble` — in-flow, content-box) and the `.bubble--out` exit fade, which beats `bubble-in` at equal specificity **only because `main.tsx` imports tokens.css before styles.css** — never reorder those imports. `BUBBLE_OUT_MS` must equal `--t-bubble-out`, and `tests/bubble.test.ts` is the only thing linking the two (it does not guard the import order). **The bubble is non-interactive by decision** (recorded in `docs/design/DESIGN.md`): purely narrative, opens nothing, `pointer-events: none` — wheel and clicks pass through to the rig. Accessibility is issue #49.

### Bubble content and anchors (`src/content/bubbles.ts` + `src/lib/bubbleAnchors.ts`)

One bubble per stop (issue #48). `BUBBLES` is the **single source of the copy** — `CameraStop` no longer has a `caption`, and `Bubble.tsx` contains no text. Each entry carries its phrase (verbatim from the design mockups, in French — bilingual is #33), the `.glb` nodes it is anchored to, and its **centre in the design's 1280×720 frame**.

**Those centres were measured on the mockups, not copied from the placement table.** `DESIGN.md` writes placement as the bubble's top-left corner; `<Html center>` positions its centre. `tests/bubbleAnchors.test.ts` re-extracts the mockups' text so shipped copy cannot silently drift from the design session's.

`designAnchor()` **un-projects** that frame fraction into the stop camera's frustum. The split is the whole idea: the **direction** comes from the design (and alone decides where the bubble lands — a point's projected position never depends on its distance), the **depth** comes from the anchored object and alone decides the **parallax** as the camera leaves. That is what a world anchor buys over a `left: 4%`. An object missing or behind the camera warns and falls back to 3 m — measured, that only costs parallax.

`clampToSafeArea()` then keeps the bubble 12 px from every edge: the table is written in fractions but a bubble keeps its pixel width, so on a frame narrower than 1280 an edge bubble would clip (measured: −2 px at 1000 px wide). 12 px is the design's own tightest margin — a wider one would move bubbles the design session validated. It is a no-op at 16:9, verified stop by stop.

**Numbering follows the tour, not the mockups** (product decision, 2026-08-18): `bubbleKicker()` numbers by rank among titled bubbles, so home stays unnumbered and reordering `CAMERA_STOPS` renumbers everything on its own. The mockups' numbers are their capture order (01 desk, 02 cv…) and are stale by construction; their _text_ is not.

The eleven bubbles are all mounted at once in `Experience.tsx` and driven by `visible` alone — unmounting the one being left would take its exit fade with it. A bubble that is neither visible nor fading renders `null`.

### The preloader (`src/ui/Preloader.tsx` + `src/state/loading.ts`)

Issue #25, and the only interesting part is **where the progress comes from**. Not drei's `useProgress`: it is fed by `DefaultLoadingManager.onProgress`, which counts **items**. Measured on v13, the manager sees 18 — the `.glb`, the two draco files, and 14 `blob:` URLs (the embedded webp textures, which GLTFLoader re-loads through ImageLoader). The 3 MB `.glb`, the only thing that takes time on a real network, is therefore 1/18 of the bar; worse, `total` grows as items are discovered (1 → 4 → 18), so the bar **goes backwards** (1/4 = 25% at t+33 ms, then 2/18 = 11% at t+41 ms).

So the bar tracks the `.glb`'s **bytes**, via `useLoader`'s `onProgress` — which is why `RoomModel` calls `useLoader` directly instead of drei's `useGLTF` (it drops the callback), and why **the module-scope `preload` is gone**: `useLoader.preload` takes no `onProgress`, and being the call that actually started the fetch, it made the bar structurally mute. `three-stdlib` supplies the loaders, not `three/examples/jsm`, whose DRACOLoader declares its decoder files as `new URL(…, import.meta.url)` — Vite resolves those statically and emits 1.3 MB of decoder into `dist/` that nothing ever fetches.

Two signals, two jobs: **bytes move the bar, `ready` unmounts the screen.** Between them sits a mute tail (draco decode, 14 textures, 146 materials rebuilt) measured at ~300 ms on a fast desktop, which emits no progress at all — so bytes only fill `BYTES_SHARE` (90%) of the bar, and the last tenth closes on `ready`. The preloader is mounted by `App.tsx` **outside** the `<Suspense>`, because there are two waits to cover — the 3D chunk, then the `.glb` — and mounting it inside App3D left the first one bare (measured: 306 ms of empty screen in dev). It **unmounts** rather than hiding, so `?stop=` captures stay deterministic; `PRELOAD_OUT_MS` must equal `--t-preload-out`, and `tests/preloader.test.ts` is the only thing linking them.

### The menu bar (`src/ui/Menu.tsx` + `src/content/menu.ts`)

Issue #26: the persistent navigation, never unmounted — that is what makes it reachable from any point of the tour, and the 40% resting opacity is what lets it be permanent without competing with the room. Accueil → `Home`, Résumé → `CV`, **Projets → `Cabinet`** (product decision, 2026-08-18: the projects live in the chest of drawers, not on the desk). It requests a stop by `label` and `CameraRig` flies there; there is no pose in the menu.

Three input routings, none of which may regress:

- **Wheel**: the bar does _not_ capture it. `CameraRig` listens on `.stage` and only ignores `.panel`; a wheel over the menu still tours (verified — the gesture fires normally). The bar has nothing to scroll.
- **Arrows**: `CameraRig` steps stop-to-stop with them, so it now bails on any key event whose target is inside `.menu` — the keyboard counterpart of the `.panel` wheel rule. Inside the bar, ↑↓ roll focus between items.
- **Mouse**: a mouse click blurs the item afterwards (`e.detail > 0`), handing the arrows back to the tour. A keyboard activation (`detail === 0`) keeps focus where it is.

**The diagnostic HUD is now gated behind `?debug`.** `viewMode.ts` had declared that contract since the spike but nothing was wired to it, so the HUD rendered always — and its stop rail sat pixel-for-pixel on top of the menu bar, both at `z-index: 200`. Two navigations stacked in the same place is what a "cheap" bar looks like. The HUD is still the phase/rail/panel-button tooling, one `?debug` away.

The active item is an exact stop match, and it lights up on _departure_, not arrival — `goToIndex` sets `stopIndex` when the tween starts. A section pointing at a stop that no longer exists is dropped with a console warning (same discipline as a missing `CameraStop_*`); `tests/menu.test.ts` fails before that can ship. A social with no URL is not rendered at all — a bar whose promise is "contact in two clicks" may not show a dead link. The FR/EN toggle is rendered because it is the mockups' anatomy, but EN is `disabled` until #33.

**The second click does not exist yet.** #26 was closed on the bar alone (product decision, 2026-08-18); reaching a project card once parked at the Cabinet was deliberately deferred, and this paragraph is its only written trace — there is no follow-up issue.

### The CV on the vertical monitor (`src/ui/CvScreen.tsx` + `src/content/cv.ts`)

Issue #93. Seven blocks that must read as being displayed **by** the scene's second monitor, not floating over it: the name, then photo · savoir-être · langues & permis, savoir-faire, « Le cap », Expériences, Formations. The name **decrypts on arrival** (1600 ms, `--t-decrypt` ↔ `DECRYPT_MS`) — characters settle left to right and spaces are never scrambled, since they are what holds the name's silhouette. It is set in a **monospace** face on purpose: in a proportional one every random glyph changes the word's width and the name jitters. Every other title decrypts too, in a **cascade** (420 ms, `--t-cascade`, 60 ms apart, top to bottom), and **one clock drives them all** — fifteen titles each with their own `rAF` loop and state would be fifteen React renders per frame next to a 3D scene, so `Scrambled` is pure and derives its text from an elapsed time passed in. The glyph draw is **deterministic** (from frame + position, never `Math.random`) because the component runs during React's render phase. Being self-starting, the whole cascade is **cut**, not shortened, under `prefers-reduced-motion`.

**The top of the CV never moves.** It is therefore **not centred**: centring means anything that grows it also pulls it up — half of what an accordion adds is taken back at the top, and no reserve fixes that exactly since the four accordions differ in height (78–91 px). It is anchored under an **incompressible spacer** (`.cv::before`, `flex: 0 0 auto`, `min(13vh, 220px)`) that makes it read as centred at rest. _Incompressible_ is the load-bearing word: a `0 1 auto` spacer holds until something overflows and then yields — measured at 9 px on the first accordion at 1512×945, where the CV already overflows at rest, and a second spacer at the bottom does not help because at that size it is already at zero. Measured after: **0 px across all eight cartouches, at 1795×1300, 1512×945 and 1280×720.** The price is a spacer that stays put while scrolling: a little more scrolling, but nothing jumps under the cursor.

Corollary: **no layout rule may depend on a hover.** The previous attempt tuned a margin through `:has(.job:hover)`, which also fired on the **formations** — hovering a diploma, which opens nothing, moved the whole CV.

Hovering a cartouche runs a **sweep** (700 ms, `--t-sweep`) — a cold sliver crossing it once. It promises nothing (the formations, which never open, have it too); it acknowledges the pointer. Gesture-triggered, so reduced motion **keeps** it. Section titles carry the cold accent while card titles stay muted cream: colour carries the hierarchy, no extra size or weight. `docs/design/screens/02-cv.html` is the reference and `docs/design/tokens.css` holds the anatomy — the app and the mockup share one definition, and the mockup's own `<style>` is empty on purpose.

Four things are load-bearing:

- **It is not a phase.** `interaction.ts`'s rule is that each phase owns ONE input routing, and the CV owns none of its own — it is derived from existing state, `phase === 'parked'` + the `CV` stop, exactly as `Experience` derives which bubble is visible. Adding a phase would force `CameraRig` to answer a phase that asks nothing.
- **It is not modal.** At `--z-bubble` (100) it passes UNDER the menu bar (200): « Résumé » is how you got here and must stay the way out.
- **It centres, scrolls when it must, and does NOT carry `.panel`.** The project is full-screen-first (author's decision, 2026-08-20): the six sections (~910 px, ~990 with an accordion open) fit and centre on a full screen, and overflow a 720 frame. Hence `justify-content: **safe center**` and never `center` alone — a plain `center` overflows on _both_ sides and a container never scrolls negative, so the top half would become unreachable; `safe` falls back to `flex-start` exactly there, and so does a browser that does not know the keyword. `.panel` would make the rig ignore _every_ wheel event over it and you could never leave the stop by scrolling. Instead `CvScreen` arbitrates notch by notch: it `stopPropagation()`s while it still has travel in that direction and hands the wheel back to the tour at either end. The listener is **native**, not React's `onWheel` — `CameraRig` listens natively on `.stage`, and React 19 delegates its synthetic handlers to a container that is an _ancestor_ of `.stage`, so a synthetic `stopPropagation` fires after the tour has already moved (measured: it did).
- **The height budget is the scarce resource.** Several values that read as taste are what keep the layout from breaking, and each is commented with its measurement in `tokens.css` — `.cv__card--traits { flex: 1.4 }` with a 6 px gutter (at 1.5/9 px, measured at 1000 px wide, the CV grows 50 px and overflows), and no `overflow-wrap: anywhere` on the tile labels (it split « Curiosité » into « Curiosit / é »). `tests/cv.test.ts` locks the two constraints checkable without a browser: exactly six traits, and « Le cap » under 400 characters.

Both tile strips share one anatomy. **An absent `icon` is the fallback, never a load error**: no `onError` is wired, the data decides. Without a file the tile shows the name's **initial** in monochrome cream; with one it renders an `<img>`, in **colour** — a monochrome brand mark does not look like the brand.

### Bilingual FR/EN (`src/lib/locale.ts` + `src/state/locale.ts`)

Issue #33. The toggle in the menu bar is live; **every visitor-facing string goes through the translation system**, and the one deliberate exemption is `Hud.tsx` — `?debug` tooling, never served to a visitor, already in English.

- **`resolveLocale` is pure** (stored value + `navigator.languages` injected), like `resolveExperience`, so `tests/locale.test.ts` locks the rule in Node with no DOM. Order: a stored choice always wins, then the first _understood_ entry of the preference **list** (a visitor set to `de-DE, fr-FR, en` speaks French — reading only `navigator.language` would serve them English and call it detection), then English.
- **There is no `?lang=`.** URL params here are dev tooling (`viewMode.ts`); the language is a visitor choice, with a toggle and a memory.
- **The initial locale resolves at module load**, before the first render — a visible FR→EN flip on the first frame would be worse than no detection.
- **`document.documentElement.lang` is written in exactly one place**, an effect in `App.tsx`. `index.html` ships `lang="fr"` and the store may resolve `en`; two writers of the same attribute drift, and it is the first paint that would be wrong — the one no test looks at.
- **`Localized` is opt-in per field.** A plain `string` next to a `Localized` means _language-neutral by decision_, not a forgotten translation: tech names, periods, `C1`, and `B` (a French licence class with no English equivalent). `MaybeLocalized` + `tm()` cover fields that are sometimes one and sometimes the other — `Français / natif` translates, `Anglais / C1` does not, in the same field.
- **Bubbles translate their `subject` and `text` only.** The anchor, the measured `center` and the `maxWidth` stay shared: they describe geometry measured on the scene and on the mockups, not text, and duplicating them per language would be two sources of truth for one thing. The design mockups are French, so `tests/bubbleAnchors.test.ts` guards **FR verbatim only** — English has no mockup and is deliberately unguarded beyond "exists and is non-empty". Measured after translating: all eleven EN bubbles stay inside the frame at 1280×720 and 1920×1080.
- **The FR/EN toggle is two `<button>`s**, so `tokens.css` resets `appearance`, `background`, `border` and `font` on them — a button does **not** inherit `font-family`, and that exact oversight is what once made the bar read as cheap. The active side stays rendered and clickable: disabling it would remove the indicator that says which language you are in.

### The preselection gate (`src/App.tsx` + `src/lib/experienceChoice.ts`)

`App.tsx` is a DOM-only router (issue #24): preselection screen → lazy-loaded `App3D` (the Canvas) or the classic placeholder. The lazy import is **load-bearing** — a static import path from the entry chunk would ship all of three/R3F/drei to every visitor, including the ones who pick classic. It used to be even more load-bearing: `RoomModel` fired `useGLTF.preload` at module scope, so importing it _at all_ started the 3 MB download. That preload is gone (#25) — `useLoader.preload` takes no `onProgress`, and being the call that actually started the fetch, it left the preloader's bar with no data to show. The load now starts on `RoomModel`'s first render, a few ms later. A stored `classic` choice (localStorage, `portfolio.experience`) is honoured without ever probing WebGL; a missing WebGL context auto-falls back to classic. Every dev URL param below bypasses the gate straight to 3D so the render-comparison loop stays deterministic. The screen recreates `docs/design/screens/0a-preselection.html`; `docs/design/tokens.css` is imported directly by `main.tsx` (single source of truth, no copy).

### URL parameters (dev tooling — keep working)

- `?stop=<label>` — deterministic camera snap (render-comparison loop + shareable links)
- `?outline=`, `?lw=` — ink A/B and width
- `?debug` — the diagnostic HUD (phase banner, stop rail, panel/telescope buttons); `?debug-fly` — fly mode, not yet ported to R3F
- `?capture` — `preserveDrawingBuffer` for the render-comparison loop; nothing else (#45)
- `?choose` — clears the stored 3D/classic choice and reopens the preselection screen

## Conventions

- Path alias `@/` → `src/` (in `vite.config.ts` and `tsconfig.json`).
- No initial camera pose is seeded in `App3D.tsx`: `<Suspense>` holds the first frame until the .glb is parsed, and `CameraRig` places the camera from the glb's own cameras on the frame after. Nothing ever renders at the origin, so there is no pose to hardcode.
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
