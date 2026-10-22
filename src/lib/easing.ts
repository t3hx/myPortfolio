/**
 * Les eases de l'intro (#143), en fonctions pures.
 *
 * Le prototype du handoff n'en utilise que trois, nommées par leur rôle :
 * `enter` (power4.out — une entrée qui freine), `draw` (sine.inOut — un tracé
 * qui part et arrive en douceur), `pop` (back.out — un dépassement qui
 * revient). Ce sont les courbes GSAP du même nom, réécrites ici pour ne pas
 * embarquer une timeline : toute l'intro est fonction pure de T, et une
 * timeline n'apporterait que des labels que personne ne cherche.
 *
 * **La quatrième est arrivée par une mesure, pas par goût** (#147). Les trois
 * du prototype ARRIVENT À L'ARRÊT — c'est le propre d'un `out` et d'un
 * `inOut`. Le zoom du panoramique finissait donc sa course à vitesse nulle, et
 * la plongée repartait de zéro : mesuré, 0,007 de zoom par seconde à la
 * jointure, contre 0,55 au plus fort du panoramique. Un tiers de seconde
 * d'immobilité entre deux mouvements que le spectateur lit comme un seul. Il
 * fallait une courbe qui n'arrive pas.
 */
export type Ease = (u: number) => number

/** GSAP `power4.out`. */
export const easeOutQuart: Ease = (u) => 1 - Math.pow(1 - u, 4)

/**
 * GSAP `sine.in` — le miroir de `sine.inOut` : elle part de l'arrêt et arrive
 * À PLEINE VITESSE. C'est la seule chose qu'on lui demande : passer le relais.
 */
export const easeInSine: Ease = (u) => 1 - Math.cos((u * Math.PI) / 2)

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
