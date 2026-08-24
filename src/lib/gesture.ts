/**
 * Le détecteur de geste de la molette — **une fonction pure**, pour que la
 * règle soit vérifiable ailleurs que sous les doigts (#116).
 *
 * Ce que le rig en fait : la molette est *possédée* (`preventDefault`), et un
 * geste est une COMMANDE (« va à l'arrêt suivant »), jamais une position. Ce
 * fichier ne décide que d'une chose : ce train d'événements `wheel`, combien
 * de pas vaut-il ?
 *
 * **La règle, depuis le 2026-08-24 : un geste vaut exactement UN pas, quelle
 * que soit son intensité.** Elle en remplace une autre, qui était validée et
 * qui est retirée sciemment : un défilement maintenu enchaînait les arrêts un
 * par un. Enchaîner exige désormais un geste NEUF.
 *
 * Ce que ce fichier ne fait pas, et c'est délibéré : **il ne regarde pas
 * l'horloge à l'intérieur d'un geste.** Sous une image qui saute, la cadence
 * de livraison des événements ment ; la forme du momentum, elle, ne ment pas —
 * il décroît, ne dépasse jamais son pic, ne s'inverse jamais. Le seul emploi
 * de l'horloge est le silence qui *clôt* un geste, entre deux courses.
 */

/** Delta accumulé qui déclenche un pas. */
export const GESTURE_THRESHOLD_PX = 65

/** Le silence qui clôt un geste et en autorise un nouveau. */
export const GESTURE_RESET_MS = 250

/**
 * Sous ce delta, on ignore : c'est du tremblement sub-pixel.
 *
 * **Ne pas s'en servir pour calmer le détecteur.** Il a valu 28, et à cette
 * valeur il mangeait des gestes entiers — un balayage doux de trackpad émet
 * des deltas de 5 à 20 px et doit compter.
 */
export const MIN_COUNTED_DELTA = 6

export interface GestureState {
  /** Delta accumulé depuis le début du geste, ou depuis le dernier pas. */
  acc: number
  /** Le geste peut-il encore tirer un pas ? Faux dès qu'il en a tiré un. */
  armed: boolean
  /** Signe du dernier delta compté ; 0 tant qu'aucun ne l'a été. */
  prevSign: number
  /** Horodatage du dernier événement, en ms. */
  lastAt: number
}

export function idleGesture(): GestureState {
  return { acc: 0, armed: true, prevSign: 0, lastAt: 0 }
}

/**
 * Un événement `wheel` de plus. Renvoie l'état suivant et le pas à tirer :
 * `1` en avant, `-1` en arrière, `0` pour ne rien faire.
 *
 * Un geste est clos par le SILENCE, et par rien d'autre — surtout pas par
 * l'état de la caméra. Une première version interdisait de réarmer tant qu'une
 * course durait, pour empêcher un geste de tirer deux pas : mesuré dans le
 * navigateur, ça interdisait surtout à la DEUXIÈME chiquenaude d'exister,
 * puisqu'une course dure 1,2 s et qu'on enchaîne bien avant. Le garde-fou
 * était inutile par-dessus le marché : un momentum n'a pas de trou de 250 ms,
 * il émet à la cadence de l'image jusqu'à mourir.
 */
export function feedWheel(
  state: GestureState,
  delta: number,
  now: number,
): { state: GestureState; step: -1 | 0 | 1 } {
  const next: GestureState = { ...state }

  // Un silence clôt le geste précédent. C'est le SEUL réarmement automatique :
  // tant que les événements s'enchaînent, on est dans le même geste, qu'il
  // s'agisse d'un doigt qui pousse encore ou d'un momentum qui meurt. Les
  // distinguer demandait de deviner l'intention à partir de l'amplitude, et
  // c'est précisément cette devinette qui franchissait deux étapes.
  if (now - next.lastAt > GESTURE_RESET_MS) {
    next.acc = 0
    next.armed = true
    next.prevSign = 0
  }
  // Mis à jour même pour un delta ignoré : un tremblement fait partie du
  // geste, il ne doit pas compter comme un silence.
  next.lastAt = now

  if (Math.abs(delta) < MIN_COUNTED_DELTA) return { state: next, step: 0 }

  // Un changement de direction est une intention neuve : le momentum ne
  // s'inverse jamais. Repartir en arrière juste après être allé en avant doit
  // répondre tout de suite, sans attendre le silence.
  //
  // Un rebond de fin de course ne peut pas en profiter : il réarme, mais
  // `acc` repart de zéro et il faudrait GESTURE_THRESHOLD_PX de delta opposé
  // pour tirer quoi que ce soit — un rebond mourant n'y arrive pas.
  const sign = Math.sign(delta)
  if (next.prevSign !== 0 && sign !== next.prevSign) {
    next.armed = true
    next.acc = 0
  }
  next.prevSign = sign

  if (!next.armed) return { state: next, step: 0 }

  next.acc += delta
  if (Math.abs(next.acc) < GESTURE_THRESHOLD_PX) return { state: next, step: 0 }

  // Le geste est CONSOMMÉ. Il ne se réarmera ni à la fin de la course, ni
  // parce que ses deltas se remettent à croître — seulement au prochain
  // silence, ou sur un demi-tour.
  const step = Math.sign(next.acc) as -1 | 1
  next.acc = 0
  next.armed = false
  return { state: next, step }
}
