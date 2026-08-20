import { NoToneMapping, SRGBColorSpace, type ToneMapping } from 'three'

/**
 * Render pipeline for the CURRENT export (portfolio_final.glb, 2026-07-20):
 * the scene is ENTIRELY pre-baked unlit — all lighting (including AgX) is
 * cooked into the textures in Blender. WYSIWYG rule: what Blender shows is
 * what Three.js must show, therefore:
 *
 *   - NO lights in the Three.js scene, no shadow maps
 *   - NoToneMapping (AgX is already in the pixels)
 *   - sRGB output, sRGB textures
 *   - every material rebuilt as MeshBasicMaterial from its `runtime` tag
 *     (glTF extras — see RoomModel and docs/PORTFOLIO_3D_INTERACTIONS.md §0)
 *
 * This REPLACES the legacy blenderMatch.ts (light multiplier, AgX runtime
 * tone mapping, shadow config) which belonged to the lit pre-2026-07 export —
 * see git history if the scene ever goes back to punctual lights.
 */

export const TONE_MAPPING: ToneMapping = NoToneMapping
export const OUTPUT_COLOR_SPACE = SRGBColorSpace

/** Background clear colour — near-black navy; mostly hidden by the baked sky. */
export const CLEAR_COLOR = '#04050c'

/** Path (relative to /public) of the .glb exported from Blender. */
export const MODEL_SRC = '/models/scene.glb'

/**
 * Draco decoder location. The export is Draco-compressed (3.0 MB instead of
 * 7.6 MB — geometry was ~5.4 MB of it), so the decoder is required to read it.
 *
 * Self-hosted on purpose: drei's default points at a Google CDN, which adds a
 * third-party runtime dependency, breaks offline/CSP-restricted use, and can
 * version-drift from the three build we ship. The files are copied from
 * `three/examples/jsm/libs/draco/` — refresh them when three is upgraded.
 */
export const DRACO_DECODER_PATH = '/draco/'

/** Material rebuild parameters per `runtime` tag (glTF extras). */
export const GLASS_OPACITY = 0.28
export const DECAL_ALPHA_TEST = 0.5

/** Moon low-def ↔ high-def toggle (interactions doc §2.3). */
export const MOON_LOWDEF_NAME = 'Outside_Moon'
export const MOON_DETAILED_NAMES = ['Outside_Moon_Detailed', 'Moon_Detailed']
