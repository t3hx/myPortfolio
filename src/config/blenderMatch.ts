import { AgXToneMapping, PCFSoftShadowMap, SRGBColorSpace, type ToneMapping } from 'three'

/**
 * These constants mirror your Blender scene's render/color settings so the
 * WebGL view lands as close as possible to the EEVEE viewport.
 *
 * Read straight from your live scene over MCP:
 *   - Render engine .............. EEVEE
 *   - View Transform ............. AgX   (exposure 0 EV, look None, gamma 1)
 *   - World background ........... ~linear [0.015, 0.028, 0.085] @ strength 0.06  (near-black navy)
 *   - Display device ............. sRGB
 */

/** Blender's View Transform is AgX -> use Three.js' AgX tone mapper. This is the
 *  single biggest factor in matching the look. */
export const TONE_MAPPING: ToneMapping = AgXToneMapping

/** Blender exposure was 0 EV, which maps to an exposure of 1.0. Nudge to taste. */
export const TONE_MAPPING_EXPOSURE = 1.0

export const OUTPUT_COLOR_SPACE = SRGBColorSpace

/** Background clear colour. Your world is a very dim navy, so it reads as near-black. */
export const CLEAR_COLOR = '#04050c'

/** A faint ambient term approximating the dim world light contribution (strength 0.06).
 *  Keep it low — the room is meant to be dark and moody. */
export const WORLD_AMBIENT_COLOR = '#0a1430'
export const WORLD_AMBIENT_INTENSITY = 0.15

/** glTF KHR_lights_punctual intensities are imported in physical units. If your lights
 *  come in too dim/bright vs Blender, scale them all here (1 = as exported). */
export const LIGHT_INTENSITY_MULTIPLIER = 0.015

/** Only these lights cast shadows (the rest are fill). Three.js' "fill" lights still
 *  illuminate uniformly within their cone (no occlusion), which is a deliberate
 *  trade-off: enabling shadows on EVERY light produces hard contrast that doesn't
 *  match the Blender refs (the refs benefit from EEVEE indirect light filling the
 *  shadow areas softly — Three.js has no GI). Per-light intensity dialling via
 *  LIGHT_OVERRIDES below handles the lights that bleed too much. */
export const SHADOW_CASTING_LIGHTS: string[] = ['PCBloom', 'ScoreboardAccent', 'PosterCode']

/** Per-light intensity multipliers, applied AFTER LIGHT_INTENSITY_MULTIPLIER. Matched
 *  by name substring. Use to dial back lights that would otherwise dominate the scene.
 *
 *  Identified by reading the .glb light table — `Light_WindowFill` exports at ~1631
 *  candela (intensity 24 after the global multiplier), with a 60° cone and no falloff
 *  distance. It floods the room with broad light. Killing it gives the rest of the
 *  scene room to breathe.
 *
 *  Add a name → 0 to disable; 0.3 to weaken; 1 (or omit) for full intensity. */
export const LIGHT_OVERRIDES: Record<string, number> = {
  WindowFill: 0,
  PosterAlbum: 0.3,
  MoonKey: 0.5,
}

export const SHADOW_MAP_TYPE = PCFSoftShadowMap
export const SHADOW_MAP_SIZE = 1024

/** Path (relative to /public) of the .glb you export from Blender. */
export const MODEL_SRC = '/models/scene.glb'

// --- Bloom (PostFx.vue) --------------------------------------------------------------
// Recovers EEVEE's bloom on emissive parts (LED tiles, monitors, PC fans, cat eyes,
// Hellfest poster ink, triangular wall panels). Only takes effect when PostFx is mounted
// (PortfolioScene.vue's `postFx` flag — on by default).
//
// Tuning knobs, in increasing order of "things change":
//   - LUMINANCE_THRESHOLD: pixels above this brightness bloom. Lower = more things glow.
//   - INTENSITY:           how strong the bloom add-back is on top of the base image.
//   - LUMINANCE_SMOOTHING: softens the threshold edge so things ease into bloom.
export const BLOOM_INTENSITY = 0.25
export const BLOOM_LUMINANCE_THRESHOLD = 1.3
export const BLOOM_LUMINANCE_SMOOTHING = 0.05

// --- Color grading (PostFx.vue) ------------------------------------------------------
// AgX tone mapping is designed for cinematic restraint — it pulls saturation out of
// highlights to feel filmic. The Blender references are punchier than that. A small
// HueSaturation post-pass after tone mapping puts the saturation back.
//
// IMPORTANT: the @tresjs/post-processing typings claim range [0, 1] with 1 = unchanged,
// but the underlying postprocessing.HueSaturationEffect uses [-1, +1] with 0 = unchanged
// (verified by reading node_modules/postprocessing/.../HueSaturationEffect docstring).
// Values > 1 cause hue wrap-around — use small positive values to boost.
//   -1.0 → grayscale,  0.0 → unchanged,  +1.0 → maximum saturation.
export const SATURATION = 0.3
