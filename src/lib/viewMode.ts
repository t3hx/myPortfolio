import { CAMERA_STOPS } from '@/config/cameraStops'

/**
 * URL-driven view modes, ported from the Vue prototype:
 *
 *   /              -> 'default'  (production view)
 *   /?debug        -> 'tour'     (diagnostic HUD)
 *   /?debug-fly    -> 'fly'      (free first-person navigation — NOT in the spike)
 *
 * Mode is resolved once at module load — switching modes is a page reload, by design.
 */
export type ViewMode = 'default' | 'tour' | 'fly'

function resolve(): ViewMode {
  if (typeof window === 'undefined') return 'default'
  const params = new URLSearchParams(window.location.search)
  if (params.has('debug-fly')) return 'fly'
  if (params.has('debug')) return 'tour'
  return 'default'
}

export const viewMode: ViewMode = resolve()

/**
 * Optional `?outline=<mode>` param — outline technique A/B for the contours
 * spike (design doc Next Step 3). Resolved once at module load, like the mode.
 *
 *   off   -> flat render (baseline, current look)
 *   hull  -> batched inverted hull (three OutlineEffect): silhouettes only
 *   edges -> EdgesGeometry crease lines (threshold angle): internal edges
 *   both  -> hull + edges combined (closest to Blender Line Art)
 */
export type OutlineMode = 'off' | 'hull' | 'edges' | 'both'

export const outlineMode: OutlineMode = (() => {
  if (typeof window === 'undefined') return 'off'
  const value = new URLSearchParams(window.location.search).get('outline')
  return value === 'hull' || value === 'edges' || value === 'both' ? value : 'off'
})()

/**
 * `?capture` — le drapeau de la boucle de comparaison de renders (issue #45).
 *
 * Il fait UNE chose : demander `preserveDrawingBuffer` au contexte WebGL, sans
 * quoi `canvas.toDataURL()` rend une image noire — le navigateur vide le
 * tampon de dessin dès qu'il l'a composité.
 *
 * Pourquoi lire le tampon plutôt que capturer la page : les références de
 * `docs/renders/refs/` sont des rendus Blender NUS, sans une ligne d'interface.
 * Une capture de page contient la bulle, la barre de menu et, depuis #93, le
 * CV — l'écart mesuré serait dominé par du DOM qu'on n'a jamais voulu comparer,
 * et chaque nouvel élément 2D le fausserait un peu plus, en silence. Le tampon
 * GL, lui, ne contient QUE ce que three a dessiné, par construction.
 *
 * Le drapeau est demandé au chargement et jamais en production : garder
 * `preserveDrawingBuffer` allumé coûte une copie de tampon à chaque image.
 */
export const captureMode: boolean =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('capture')

/**
 * Optional `?stop=<label>` deep-link — snaps the camera to that stop on load.
 * Used by the Playwright render-comparison loop (deterministic framing vs
 * docs/renders/refs/) and shareable URLs. Matches the friendly label,
 * case-insensitive, prefix allowed ('bookshelf' → 'BookshelfPlant').
 * Returns the stop index, or null.
 */
export function stopParamIndex(): number | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('stop')?.toLowerCase()
  if (!value) return null
  const index = CAMERA_STOPS.findIndex(
    (s) => s.label.toLowerCase() === value || s.label.toLowerCase().startsWith(value),
  )
  return index === -1 ? null : index
}
