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
 * `design/renders/refs/` sont des rendus Blender NUS, sans une ligne d'interface.
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
 * Optional `?stop=<label>` deep-link — snaps the camera to that view on load.
 * Used by the Playwright render-comparison loop (deterministic framing vs
 * design/renders/refs/) and shareable URLs. Matches the friendly label,
 * case-insensitive, prefix allowed ('bookshelf' → 'BookshelfPlant').
 *
 * Deux familles de cibles depuis #97 : les arrêts du tour, et la VUE LUNE.
 * Elle n'est pas un arrêt (#113 l'a sortie du tour — on la découvre en
 * cliquant le télescope), mais elle reste adressable : la boucle de
 * comparaison a besoin d'un chemin déterministe vers elle pour vérifier
 * `moon.png`, et `?stop=Moon` était un lien valide et partageable avant #113 —
 * un ancien lien qui atterrit ailleurs en silence ne dit pas au visiteur
 * qu'il a raté quelque chose. Un arrêt du tour prime à préfixe égal : le tour
 * d'abord, l'excursion ensuite.
 *
 * Le parseur est PUR (la valeur en entrée, jamais `window`) pour que
 * `tests/stopParam.test.ts` verrouille ces règles en Node.
 */
export type StopParam =
  | { kind: 'none' }
  | { kind: 'stop'; index: number }
  | { kind: 'moon' }
  | { kind: 'unknown'; value: string }

export function parseStopParam(raw: string | null): StopParam {
  const value = raw?.toLowerCase()
  if (!value) return { kind: 'none' }
  const index = CAMERA_STOPS.findIndex(
    (s) => s.label.toLowerCase() === value || s.label.toLowerCase().startsWith(value),
  )
  if (index !== -1) return { kind: 'stop', index }
  // `moon`, ou le nom complet du nœud caméra pour les liens historiques.
  if ('moon'.startsWith(value) || 'telescopemoon'.startsWith(value)) return { kind: 'moon' }
  return { kind: 'unknown', value }
}

function readStopParam(): StopParam {
  if (typeof window === 'undefined') return { kind: 'none' }
  return parseStopParam(new URLSearchParams(window.location.search).get('stop'))
}

/** L'index d'arrêt demandé par `?stop=`, ou null (absent, inconnu, ou vue lune). */
export function stopParamIndex(): number | null {
  const parsed = readStopParam()
  if (parsed.kind === 'unknown') {
    // Même discipline que le menu et `extractStops` : un `?stop=` qui ne
    // correspond à rien retombait sur l'accueil sans un mot — le mode de panne
    // exact que #113 avait rendu réel avant que la vue lune ne redevienne
    // adressable.
    console.warn(
      `[stops] "?stop=${parsed.value}" ne correspond à aucun arrêt de CAMERA_STOPS — accueil par défaut.`,
    )
    return null
  }
  return parsed.kind === 'stop' ? parsed.index : null
}

/** `?stop=moon` — la vue lune, posée d'emblée (#97). */
export function moonViewRequested(): boolean {
  return readStopParam().kind === 'moon'
}

/**
 * `?accent=<hex>` — l'accent de l'intro, forcé depuis l'URL (#147). Outillage
 * de dev, comme `?lw=` : la couleur définitive est un token de `tokens.css`,
 * et ce paramètre reste la façon de comparer une candidate SANS toucher au
 * code, en la voyant projetée sur l'écran dans la scène.
 *
 * **Le croisillon s'écrit sans croisillon.** `?accent=#00C0E8` ne marche pas :
 * le `#` ouvre le fragment de l'URL, et le paramètre reçu serait vide. On écrit
 * donc `?accent=00C0E8`, et le `#` est remis ici — il reste accepté, pour le
 * jour où la valeur arrive encodée (`%2300C0E8`).
 *
 * Une valeur qui n'est pas une couleur est REFUSÉE avec un mot, jamais reprise
 * en silence : le navigateur ignore une couleur qu'il ne comprend pas, et
 * l'arbitrage se ferait alors sur l'accent par défaut en croyant regarder la
 * candidate. C'est le mode de panne d'un outil de comparaison qui compare la
 * même chose deux fois.
 *
 * Pure, comme `resolveLocale` et `resolveExperience` : la lecture de l'URL est
 * le travail de l'appelant, et `tests/intro.test.ts` la vérifie sans DOM.
 */
export function parseAccent(raw: string | null): string | null {
  if (!raw) return null
  const hex = raw.startsWith('#') ? raw : `#${raw}`
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
    console.warn(`[intro] "?accent=${raw}" n'est pas une couleur hexadécimale — accent par défaut.`)
    return null
  }
  return hex
}

export function introAccentFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  return parseAccent(new URLSearchParams(window.location.search).get('accent'))
}
