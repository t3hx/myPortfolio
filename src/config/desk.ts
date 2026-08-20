/**
 * Le bureau qui respire (issue #35) — ventilateurs du PC et fumée de la tasse.
 *
 * Les noms viennent du `.glb`. L'AXE de chaque ventilateur, lui, n'est pas
 * écrit ici : il est déduit de la géométrie (voir `fanAxis`), parce qu'un
 * ventilateur est un disque et que sa dimension la plus fine EST son axe.
 * Mesuré sur l'export : `0,0951 × 0,0149 × 0,0951` pour les faces haute et
 * basse, `0,14 × 0,14 × 0,0125` pour l'arrière, `0,0149 × 0,0951 × 0,0951`
 * pour le côté droit — les trois orientations que la spec décrivait à la main.
 */

export const PC_FANS = [
  'Tech_PCCase_FanBottom_1',
  'Tech_PCCase_FanBottom_2',
  'Tech_PCCase_FanBottom_3',
  'Tech_PCCase_FanRear',
  'Tech_PCCase_FanRight_1',
  'Tech_PCCase_FanRight_2',
  'Tech_PCCase_FanRight_3',
  'Tech_PCCase_FanTop_1',
  'Tech_PCCase_FanTop_2',
  'Tech_PCCase_FanTop_3',
] as const

/** Tours par seconde, bornes du tirage. La spec proposait 2 à 4 : au-delà, le
 *  disque devient un flou uniforme et on ne voit plus qu'il tourne. */
export const FAN_RPS_MIN = 2
export const FAN_RPS_MAX = 3.2

/**
 * Le matériau des PALES. Chaque ventilateur est un maillage à DEUX primitives —
 * `Mat_FanFrame` (144 indices, le support rond) et `Mat_FanBlade` (78, les
 * pales) — que le chargeur glTF monte en deux `Mesh` frères sous un groupe.
 * Faire tourner le groupe faisait tourner le support avec les pales, ce qui ne
 * ressemble à rien : un support de ventilateur est vissé au boîtier.
 *
 * Le nom survit à la reconstruction des matériaux (`RoomModel` recopie
 * `src.name`), c'est donc lui qui distingue les deux.
 */
export const FAN_BLADE_MATERIAL = 'Mat_FanBlade'

/**
 * Le sens de rotation, LE MÊME pour tous.
 *
 * Il était alterné, pour « casser l'impression de bloc » — c'était une idée
 * de designer appliquée à de la mécanique : dans un vrai boîtier, tous les
 * ventilateurs sont montés dans le même sens. Ce qui doit varier, c'est la
 * vitesse, pas le sens.
 *
 * Négatif autour de l'axe de chaque ventilateur : une rotation positive vue
 * depuis le bout de l'axe est anti-horaire, donc une rotation négative est
 * horaire. Vérifié en capture, en suivant une pale d'une image à l'autre.
 */
export const FAN_SPIN = -1

/** Le nœud dont la surface émet la fumée : le café, pas la tasse. */
export const MUG_SURFACE = 'Prop_Mug_Coffee'

/**
 * Nombre de bouffées.
 *
 * **Calibré à la mesure, pas à l'estime.** À 22, les bouffées ne se touchaient
 * pas : on lisait des points isolés qui flottent, pas un panache. Ce qui fait
 * la fumée n'est pas la bouffée, c'est le RECOUVREMENT — il en faut assez pour
 * que leurs bords se chevauchent, et chacune doit être d'autant plus discrète
 * qu'elles sont nombreuses.
 */
export const SMOKE_PUFFS = 120
/** Hauteur de montée d'une bouffée, en mètres, avant de disparaître. */
export const SMOKE_RISE = 0.22
/** Durée de vie d'une bouffée, en secondes. Lent : c'est ce qui dit « chaud »
 *  plutôt que « qui bout ». */
export const SMOKE_LIFE = 5.5
/** Écartement latéral au sommet de la montée, en mètres. Étroit : c'est un
 *  FILET qui monte et s'évase à peine, pas un nuage qui s'étale. */
export const SMOKE_DRIFT = 0.022
/** Taille d'une bouffée en pixels d'écran, au départ puis en fin de vie. */
/**
 * Taille d'une bouffée en pixels d'écran, au départ puis en fin de vie.
 *
 * **C'est la taille qui fait la différence entre de la fumée et de la
 * poussière**, pas l'opacité. À 15–54 px les disques ne se recouvraient pas :
 * on lisait des petits points blancs disparates. Il faut qu'une bouffée en
 * recouvre plusieurs autres pour que leurs bords disparaissent dans la somme —
 * d'où des disques très larges, très transparents, et nombreux.
 */
export const SMOKE_SIZE_MIN = 26
export const SMOKE_SIZE_MAX = 78
/** Opacité maximale d'UNE bouffée. Très basse, parce qu'elles se recouvrent :
 *  c'est la somme qui doit se lire comme de la vapeur, pas chaque disque. */
export const SMOKE_OPACITY = 0.013
