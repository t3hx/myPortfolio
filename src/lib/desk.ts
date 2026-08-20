import {
  FAN_RPS_MAX,
  FAN_RPS_MIN,
  SMOKE_DRIFT,
  SMOKE_LIFE,
  SMOKE_OPACITY,
  SMOKE_RISE,
} from '@/config/desk'

/**
 * Les maths du bureau qui respire (issue #35), **pures** : ni three.js ni DOM.
 * `tests/desk.test.ts` les verrouille — une vitesse de rotation et une courbe
 * de fumée se vérifient sur des nombres.
 */

/**
 * L'axe de rotation d'un ventilateur, déduit de ses dimensions locales.
 *
 * Un ventilateur est un disque : sa dimension la plus fine est perpendiculaire
 * à son plan, donc c'est son axe. Le déduire plutôt que l'écrire en dur vaut
 * pour les dix d'un coup, survit à un ré-export qui réoriente le boîtier, et
 * ne se trompe pas — la spec listait les trois orientations à la main, ce qui
 * est juste aujourd'hui et faux le jour où l'on ajoute un ventilateur.
 *
 * Retourne l'indice de l'axe : 0 = x, 1 = y, 2 = z.
 */
export function fanAxis(size: [number, number, number]): 0 | 1 | 2 {
  let axis: 0 | 1 | 2 = 0
  for (const i of [1, 2] as const) if (size[i] < size[axis]) axis = i
  return axis
}

/**
 * La vitesse d'un ventilateur, en tours par seconde.
 *
 * **Désynchronisée d'un ventilateur à l'autre**, et c'est tout l'enjeu : dix
 * disques identiques tournant à la même vitesse se lisent comme une seule
 * pièce mécanique, ce qu'un boîtier de PC n'est pas. Le tirage est
 * déterministe — indexé sur le rang — pour que la scène soit reproductible.
 */
export function fanSpeed(index: number): number {
  const r = fract(Math.sin(index * 78.233) * 43758.5453)
  return FAN_RPS_MIN + r * (FAN_RPS_MAX - FAN_RPS_MIN)
}

/** Le sens de rotation, alterné : deux ventilateurs voisins qui tournent en
 *  sens contraire suffisent à casser l'impression de bloc. */
export function fanDirection(index: number): 1 | -1 {
  return index % 2 === 0 ? 1 : -1
}

export interface Puff {
  /** Montée depuis la surface du café, en mètres. */
  rise: number
  /** Écartement latéral, en mètres, sur deux axes. */
  driftX: number
  driftZ: number
  /** 0 → 1, pour interpoler la taille. */
  age: number
  opacity: number
}

/**
 * Une bouffée de fumée à l'instant `time`.
 *
 * Les bouffées sont réparties sur la durée de vie par leur rang, ce qui donne
 * un filet continu sans avoir à gérer une file d'émission. Chacune monte,
 * s'écarte, grossit et s'efface.
 *
 * L'opacité s'éteint **aux deux bouts** : une bouffée qui apparaît à pleine
 * opacité juste au-dessus du café clignote à chaque cycle.
 */
export function puff(index: number, count: number, time: number): Puff {
  const offset = (index / count) * SMOKE_LIFE
  const age = fract((time + offset) / SMOKE_LIFE)

  // La montée ralentit : la vapeur perd sa poussée en se refroidissant.
  const climb = 1 - Math.pow(1 - age, 2)
  // Deux sinus de périodes différentes : une volute, pas un balancement.
  const wander = Math.sin(age * 5 + index) * 0.6 + Math.sin(age * 2.3 + index * 2.1) * 0.4

  return {
    rise: climb * SMOKE_RISE,
    driftX: wander * SMOKE_DRIFT * age,
    driftZ: Math.cos(age * 3.7 + index * 1.7) * SMOKE_DRIFT * age * 0.7,
    age,
    opacity: Math.sin(age * Math.PI) * SMOKE_OPACITY,
  }
}

function fract(v: number): number {
  return v - Math.floor(v)
}
