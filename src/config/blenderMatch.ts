import { AgXToneMapping, PCFSoftShadowMap, SRGBColorSpace, type ToneMapping } from 'three'

/**
 * These constants mirror the Blender scene's render/color settings so the WebGL
 * view lands as close as possible to the EEVEE viewport.
 *
 * ⚠️ Ported from the Vue/TresJS prototype as a STARTING POINT, not a guarantee:
 * the values were calibrated against the @tresjs/post-processing chain. The R3F
 * pipeline must re-run the render comparison loop (docs/renders/refs vs actual,
 * bloom ON and OFF) before these are considered final — see the design doc
 * (eng-review issue 14).
 */

export const TONE_MAPPING: ToneMapping = AgXToneMapping
export const TONE_MAPPING_EXPOSURE = 1.0
export const OUTPUT_COLOR_SPACE = SRGBColorSpace

/** Background clear colour — a very dim navy that reads as near-black. */
export const CLEAR_COLOR = '#04050c'

export const WORLD_AMBIENT_COLOR = '#0a1430'
export const WORLD_AMBIENT_INTENSITY = 0.15

/** glTF KHR_lights_punctual intensities are imported in physical units; scale all. */
export const LIGHT_INTENSITY_MULTIPLIER = 0.015

/** Only these lights cast shadows (the rest are fill) — see the prototype docstring. */
export const SHADOW_CASTING_LIGHTS: string[] = ['PCBloom', 'ScoreboardAccent', 'PosterCode']

/** Per-light intensity multipliers, applied AFTER LIGHT_INTENSITY_MULTIPLIER,
 *  matched by name substring. */
export const LIGHT_OVERRIDES: Record<string, number> = {
  WindowFill: 0,
  PosterAlbum: 0.3,
  MoonKey: 0.5,
}

export const SHADOW_MAP_TYPE = PCFSoftShadowMap
export const SHADOW_MAP_SIZE = 1024

/** Path (relative to /public) of the .glb exported from Blender. */
export const MODEL_SRC = '/models/scene.glb'

// Bloom / saturation constants kept for the future PostFx port (not used by the
// spike — the perf ladder requires the look to hold with bloom OFF anyway).
export const BLOOM_INTENSITY = 0.25
export const BLOOM_LUMINANCE_THRESHOLD = 1.3
export const BLOOM_LUMINANCE_SMOOTHING = 0.05
export const SATURATION = 0.3
