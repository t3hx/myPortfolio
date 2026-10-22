/**
 * La géométrie du rail de défilement du CV (#194).
 *
 * Gecko ne sait styler une barre native qu'en largeur et en couleur
 * (`scrollbar-width`, `scrollbar-color` — ni rayon, ni position, ni marge).
 * La barre native du CV est donc masquée et remplacée par un rail dessiné aux
 * jetons du design system, posé dans l'air latéral entre la colonne et le
 * bezel du moniteur. Le rail est un PUR INDICATEUR : il ne capte rien, la
 * molette garde le passe-plat de `CvScreen`.
 *
 * Ce module est la partie qui peut se tromper en silence — un curseur qui
 * sort de sa piste ne lève aucune erreur, il a juste l'air cassé — d'où une
 * fonction pure, vérifiable sans navigateur (`tests/scrollRail.test.ts`).
 * `CvScreen` ne fait qu'écrire le résultat en style inline, jamais dans un
 * état React : un rendu par cran de molette à côté d'une scène 3D serait un
 * prix absurde pour deux pourcentages.
 */

/** Le curseur ne descend jamais sous cette part de la piste : en dessous, il
 *  se lit comme une poussière, plus comme une position. */
export const RAIL_MIN_FRACTION = 0.08

export interface RailMetrics {
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

/**
 * Position du curseur sur la piste, en fractions de sa hauteur — `size` et
 * `offset`, tels que `offset + size ≤ 1`. `null` quand rien ne déborde (à un
 * pixel de bruit d'arrondi près) : le rail n'a alors rien à dire et se cache.
 *
 * `scrollTop` est bridé aux butées : l'élastique de Gecko envoie des valeurs
 * négatives ou au-delà du maximum pendant le rebond, et le curseur sortirait
 * de la piste en les suivant.
 */
export function railThumb(m: RailMetrics): { size: number; offset: number } | null {
  const overflow = m.scrollHeight - m.clientHeight
  if (overflow <= 1) return null
  const size = Math.max(RAIL_MIN_FRACTION, m.clientHeight / m.scrollHeight)
  const top = Math.min(Math.max(m.scrollTop, 0), overflow)
  return { size, offset: (top / overflow) * (1 - size) }
}
