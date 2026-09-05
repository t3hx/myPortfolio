/**
 * Les trois eases de l'intro (#143), en fonctions pures.
 *
 * Le prototype du handoff n'en utilise que trois, nommées par leur rôle :
 * `enter` (power4.out — une entrée qui freine), `draw` (sine.inOut — un tracé
 * qui part et arrive en douceur), `pop` (back.out — un dépassement qui
 * revient). Ce sont les courbes GSAP du même nom, réécrites ici pour ne pas
 * embarquer une timeline : toute l'intro est fonction pure de T, et une
 * timeline n'apporterait que des labels que personne ne cherche.
 */
export type Ease = (u: number) => number

/** GSAP `power4.out`. */
export const easeOutQuart: Ease = (u) => 1 - Math.pow(1 - u, 4)

/** GSAP `sine.inOut`. */
export const easeInOutSine: Ease = (u) => -(Math.cos(Math.PI * u) - 1) / 2

/** GSAP `back.out(1.70158)` — dépasse d'environ 10 %, puis revient. */
export const easeOutBack: Ease = (u) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2)
}

const clamp01 = (u: number) => (u < 0 ? 0 : u > 1 ? 1 : u)

/**
 * Une valeur qui va de `from` à `to` entre les temps `start` et `end`, tenue à
 * `from` avant et à `to` après. C'est l'`animate` du prototype : chaque
 * grandeur de l'intro est un `tween` évalué à T.
 */
export function tween(
  from: number,
  to: number,
  start: number,
  end: number,
  ease: Ease,
): (t: number) => number {
  const span = end - start
  return (t) => {
    if (span <= 0) return t < end ? from : to
    return from + (to - from) * ease(clamp01((t - start) / span))
  }
}
