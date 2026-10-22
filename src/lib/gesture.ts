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

/**
 * De combien la traîne doit être RETOMBÉE pour qu'on accepte d'y voir une
 * poussée neuve, en fraction de son propre pic.
 *
 * C'est la moitié : au-dessous, on ne distingue pas une inertie qui meurt d'un
 * défilement appuyé qui continue.
 */
export const TAIL_DECAY = 0.5

/**
 * De combien un delta doit REMONTER au-dessus du plancher de la traîne pour
 * valoir une poussée neuve. Deux fois et demie : une inertie décroît d'une
 * image à l'autre de quelques pour cent, elle ne peut pas produire ça.
 */
export const TAIL_RISE = 2.5

export interface GestureState {
  /** Delta accumulé depuis le début du geste, ou depuis le dernier pas. */
  acc: number
  /** Le geste peut-il encore tirer un pas ? Faux dès qu'il en a tiré un. */
  armed: boolean
  /** Signe du dernier delta compté ; 0 tant qu'aucun ne l'a été. */
  prevSign: number
  /** Horodatage du dernier événement, en ms. */
  lastAt: number
  /**
   * Le plus FORT delta observé depuis le pas tiré, et le plus FAIBLE. Ces deux
   * nombres sont la forme de la traîne, et c'est tout ce qu'il faut pour y
   * reconnaître une poussée neuve sans regarder l'horloge.
   */
  tailPeak: number
  tailFloor: number
  /** La traîne a-t-elle vraiment RETOMBÉ, une fois au moins ? */
  tailFell: boolean
}

export function idleGesture(): GestureState {
  return {
    acc: 0,
    armed: true,
    prevSign: 0,
    lastAt: 0,
    tailPeak: 0,
    tailFloor: Infinity,
    tailFell: false,
  }
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
    next.tailPeak = 0
    next.tailFloor = Infinity
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

  /**
   * **LA TRAÎNE PEUT AUSSI CLORE UN GESTE, et c'est la deuxième façon.**
   *
   * Le silence était la seule, et il ne vient jamais assez tôt : l'inertie
   * d'une chiquenaude émet à la cadence de l'image pendant près d'une seconde,
   * si bien qu'une poussée lancée dedans tombait dans le geste déjà consommé.
   * Rapporté le 2026-09-07 — « l'écriture est bien passée, mais le défilement
   * ne répond plus pour la suivante ».
   *
   * La règle reste sans horloge : elle ne lit que la FORME. Une inertie décroît
   * et ne remonte pas ; un doigt qui repart fait remonter le delta. On exige
   * donc les deux, dans cet ordre — une retombée franche (le plancher passe
   * sous la moitié du pic), puis un sursaut net (deux fois et demie le
   * plancher). Un seul des deux ne suffirait pas :
   *
   * - sans la retombée, un défilement APPUYÉ se réarme, puisque ses deltas
   *   croissent et dépassent forcément leur propre début — c'est mot pour mot
   *   la régression de #116, qui faisait deux pas d'un geste ;
   * - sans le sursaut, une inertie franchirait le seuil toute seule.
   *
   * Le plancher et le pic sont mis à jour AVANT la comparaison : un delta qui
   * décroît devient le plancher, et il ne peut donc jamais être deux fois et
   * demie plus grand que lui-même. Une décroissance ne réarme rien, par
   * construction.
   */
  if (!next.armed) {
    const size = Math.abs(delta)
    next.tailPeak = Math.max(next.tailPeak, size)
    // La retombée se CONSTATE au passage, sur le delta courant comparé au pic
    // du moment, puis elle se retient. Comparer le minimum au maximum ne dirait
    // pas la même chose : dans un défilement appuyé, dont les deltas croissent,
    // le minimum est le premier et le maximum le dernier — le rapport tombe
    // sous la moitié sans que rien n'ait jamais décru.
    if (size <= TAIL_DECAY * next.tailPeak) next.tailFell = true
    next.tailFloor = Math.min(next.tailFloor, size)
    if (next.tailFell && size >= TAIL_RISE * next.tailFloor) {
      next.armed = true
      next.acc = 0
      next.tailPeak = 0
      next.tailFloor = Infinity
      next.tailFell = false
    }
  }

  if (!next.armed) return { state: next, step: 0 }

  next.acc += delta
  if (Math.abs(next.acc) < GESTURE_THRESHOLD_PX) return { state: next, step: 0 }

  // Le geste est CONSOMMÉ. Il ne se réarmera ni à la fin de la course, ni
  // parce que ses deltas se remettent à croître — seulement au prochain
  // silence, ou sur un demi-tour.
  const step = Math.sign(next.acc) as -1 | 1
  next.acc = 0
  next.armed = false
  next.tailPeak = 0
  next.tailFloor = Infinity
  next.tailFell = false
  return { state: next, step }
}
