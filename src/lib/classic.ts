import {
  CUBE_MAX_DT_S,
  CUBE_SPEED_FAR,
  CUBE_SPEED_LERP,
  CUBE_SPEED_NEAR,
  HALO_LERP,
} from '@/config/classic'

/**
 * Ce que le site classique (#29) calcule, **hors navigateur**.
 *
 * Deux boucles `requestAnimationFrame` pilotent la page — le cube de l'accueil
 * et le halo de braise — et une boucle d'animation est exactement le genre de
 * code qu'on ne relit jamais : elle a l'air juste tant qu'elle bouge. Les
 * décisions qu'elle prend sont donc des fonctions pures, ici, et
 * `tests/classic.test.ts` les rejoue en Node. Même discipline que
 * `gesture.ts` : la boucle ne garde que l'appel au DOM.
 */

/**
 * La vitesse visée du cube, en degrés par seconde, pour un curseur à
 * `distance` pixels de son centre.
 *
 * Normalisée par la DIAGONALE du viewport, pas par sa largeur : c'est la seule
 * mesure qui donne le même comportement sur un écran large et sur un écran
 * haut. Le facteur 2 fait que la vitesse maximale est atteinte à mi-diagonale
 * — au-delà, le curseur est hors de l'accueil et il n'y a plus rien à doser.
 */
export function cubeSpeed(distance: number, vw: number, vh: number): number {
  const reach = Math.hypot(vw, vh)
  if (reach === 0) return CUBE_SPEED_NEAR
  const far = Math.min(1, (distance * 2) / reach)
  return CUBE_SPEED_NEAR + far * (CUBE_SPEED_FAR - CUBE_SPEED_NEAR)
}

/** Un pas de lissage. Extrait parce qu'il est la seule chose que les deux
 *  boucles ont en commun, et qu'un lissage écrit à l'envers (`cur + (cur -
 *  cible) * k`) diverge au lieu de converger — sans jamais lever d'erreur. */
export function approach(current: number, target: number, rate: number): number {
  return current + (target - current) * rate
}

/** L'angle du cube après une image. `dt` est plafonné : un onglet revenu
 *  d'arrière-plan livre un delta de plusieurs secondes, et le cube ferait un
 *  demi-tour instantané au lieu de reprendre où il en était. */
export function spinStep(angle: number, speed: number, dt: number): number {
  return (angle + speed * Math.min(dt, CUBE_MAX_DT_S)) % 360
}

/** La vitesse après une image — un pas vers la vitesse visée. */
export function cubeSpeedStep(current: number, target: number): number {
  return approach(current, target, CUBE_SPEED_LERP)
}

/**
 * L'avancement du défilement, de 0 en haut de page à 1 en bas.
 *
 * Le dénominateur ne peut pas valoir zéro : une page plus courte que son
 * viewport donnerait `0/0`, et le halo se retrouverait à `NaN` px — donc
 * invisible, sur une page qui n'a simplement pas assez de contenu pour
 * défiler. Il vaut 0 dans ce cas, ce qui laisse le halo à sa position de
 * départ, celle que la session design a cadrée sur l'accueil.
 */
export function scrollProgress(scrollY: number, scrollHeight: number, vh: number): number {
  const max = Math.max(1, scrollHeight - vh)
  return Math.min(1, Math.max(0, scrollY / max))
}

/** Un pas de la traîne du halo. */
export function haloStep(current: number, target: number): number {
  return approach(current, target, HALO_LERP)
}

/**
 * Le décalage vertical de la nappe, en pixels — négatif, elle remonte.
 *
 * La course est la hauteur de la nappe MOINS celle du viewport : c'est
 * exactement ce qu'il faut pour que son bas affleure l'écran au départ et son
 * haut à l'arrivée. Une nappe plus courte que le viewport n'a pas de course,
 * et le `max(0, …)` est ce qui l'empêche de partir vers le bas.
 */
export function haloOffset(progress: number, sheetHeight: number, vh: number): number {
  return -progress * Math.max(0, sheetHeight - vh)
}
