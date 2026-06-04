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
export const LIGHT_INTENSITY_MULTIPLIER = 1.0

/** In Blender only these lights cast shadows (the rest are fill). glTF doesn't store the
 *  per-light shadow flag, so we re-apply it here by matching on name substrings.
 *  Set to [] to let every imported light cast shadows. */
export const SHADOW_CASTING_LIGHTS: string[] = ['PCBloom', 'ScoreboardAccent', 'PosterCode']

export const SHADOW_MAP_TYPE = PCFSoftShadowMap
export const SHADOW_MAP_SIZE = 1024

/** Path (relative to /public) of the .glb you export from Blender. */
export const MODEL_SRC = '/models/scene.glb'
