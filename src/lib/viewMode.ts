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
 * `?outline=<mode>` — la technique d'encrage. Résolu une fois au chargement.
 *
 *   off   -> rendu plat (le cuit Blender, sans un trait)
 *   hull  -> coque inversée (three OutlineEffect) : silhouettes seules
 *   edges -> traits de pli EdgesGeometry en épaisseur écran
 *   both  -> les deux
 *
 * **`edges` est le DÉFAUT depuis #41** (arbitrage produit, 2026-08-21) : c'est
 * le seul mode qui change vraiment le rendu. Mesuré sur six arrêts, `hull` ne
 * couvre que 0,0 à 1,0 % du cadre une fois peint à sa vraie couleur — dans une
 * pièce sombre, une encre sombre ne se voit pas, et ce qui le rendait lisible
 * était le bug d'espace colorimétrique corrigé dans `Outlines.tsx`. `both`
 * ajoute par-dessus un défaut que ni l'un ni l'autre n'a seul (le décalque
 * Sharmall se griffonne), pour quatre fois les appels de dessin.
 *
 * `?outline=off` reste la porte de sortie, et c'est celle que la boucle de
 * comparaison emprunte : ses références sont des rendus Blender NUS.
 */
export type OutlineMode = 'off' | 'hull' | 'edges' | 'both'

export const outlineMode: OutlineMode = (() => {
  if (typeof window === 'undefined') return 'edges'
  const value = new URLSearchParams(window.location.search).get('outline')
  return value === 'hull' || value === 'off' || value === 'both' ? value : 'edges'
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
