import {
  BLINK_GAP_MAX,
  BLINK_GAP_MIN,
  BLINK_S,
  BLINK_SQUASH,
  TAIL_PERIOD,
  TAIL_PHASE,
  TAIL_SWING,
} from '@/config/cat'

/**
 * Les maths du chat vivant (issue #37), **pures** : pas de three.js, pas de
 * DOM. C'est ce que `tests/cat.test.ts` verrouille — un balancement et un
 * clignement se vérifient sur des nombres, pas à l'œil.
 */

/**
 * Le facteur d'échelle vertical de l'œil à l'instant `time`.
 *
 * Le rythme est **déterministe mais pas régulier** : l'écart entre deux
 * clignements est tiré dans `[BLINK_GAP_MIN, BLINK_GAP_MAX]` par une suite
 * pseudo-aléatoire indexée sur le numéro du clignement. Un intervalle fixe
 * s'entend comme un métronome au bout de trois répétitions ; un vrai
 * `Math.random()`, lui, rendrait la fonction intestable.
 */
export function blinkScale(time: number): number {
  if (time < 0) return 1
  // On avance de clignement en clignement jusqu'à dépasser `time`. La suite
  // est stable, donc la même seconde donne toujours la même image.
  let t = 0
  for (let i = 0; i < 10_000; i++) {
    const gap =
      BLINK_GAP_MIN + fract(Math.sin(i * 127.1) * 43758.5453) * (BLINK_GAP_MAX - BLINK_GAP_MIN)
    if (time < t + gap) return 1
    t += gap
    if (time < t + BLINK_S) {
      // Triangle : fermeture sur la première moitié, ouverture sur la seconde.
      const p = (time - t) / BLINK_S
      const closed = 1 - Math.abs(p * 2 - 1)
      return 1 - closed * (1 - BLINK_SQUASH)
    }
    t += BLINK_S
  }
  return 1
}

/**
 * Le déplacement latéral d'un segment de queue, en mètres.
 *
 * C'est une TRANSLATION et pas une rotation : les six segments sont des objets
 * frères, chacun pivotant sur son propre centre et non sur une articulation.
 * Les faire tourner les écarterait les uns des autres ; les déplacer
 * perpendiculairement garde la queue d'un seul tenant.
 *
 * L'amplitude croît du premier segment au dernier — la base d'une queue tient
 * au corps, seule la pointe fouette.
 */
export function tailOffset(index: number, count: number, time: number): number {
  const reach = count > 1 ? index / (count - 1) : 1
  const phase = (time / TAIL_PERIOD) * Math.PI * 2 - index * TAIL_PHASE
  return Math.sin(phase) * TAIL_SWING * reach
}

/**
 * Le décalage de la pupille, borné au DISQUE de l'œil.
 *
 * Borner chaque axe séparément donnerait un carré : dans les diagonales la
 * pupille sortirait du blanc de l'œil. C'est la norme du vecteur qu'on limite.
 */
export function pupilOffset(x: number, y: number, radius: number): [number, number] {
  const length = Math.hypot(x, y)
  if (length <= 1) return [x * radius, y * radius]
  return [(x / length) * radius, (y / length) * radius]
}

function fract(v: number): number {
  return v - Math.floor(v)
}
