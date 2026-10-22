/**
 * Le chat vivant (issue #37) — pupilles, queue, clignement.
 *
 * Les noms viennent du `.glb` et sont la seule chose que Blender impose ici.
 * Le graphe de la scène est **plat** : les 157 nœuds sont tous racines, donc
 * chaque partie du chat porte sa propre transformation monde, et toutes
 * partagent la même rotation — ~52° autour de Y. C'est elle qui décide de la
 * mécanique : un décalage se calcule dans le repère DU CHAT, jamais du monde,
 * sinon la pupille glisse de travers sur l'œil.
 */

export const CAT_EYES = ['Cat_Eye_L', 'Cat_Eye_R'] as const
export const CAT_PUPILS = ['Cat_Pupil_L', 'Cat_Pupil_R'] as const
export const CAT_HIGHLIGHTS = ['Cat_EyeHighlight_L', 'Cat_EyeHighlight_R'] as const
/** Six segments, de la base vers la pointe. */
export const CAT_TAIL = [
  'Cat_TailSeg_1',
  'Cat_TailSeg_2',
  'Cat_TailSeg_3',
  'Cat_TailSeg_4',
  'Cat_TailSeg_5',
  'Cat_TailSeg_6',
] as const

/**
 * Part du rayon de l'œil que la pupille peut parcourir.
 *
 * Le rayon est MESURÉ au runtime sur la boîte englobante de l'œil, pas écrit
 * en dur : la spec proposait « 0,005 à 0,01 en unités locales », mais un
 * ré-export qui redimensionne le chat rendrait ce chiffre faux en silence.
 * Une fraction, elle, survit.
 */
export const PUPIL_TRAVEL = 0.34

/** Lissage du suivi, par seconde. Une pupille qui colle au curseur est un
 *  réticule ; une pupille qui traîne un peu est un regard. */
export const PUPIL_LERP = 6

/** Amplitude du balancement de la pointe de la queue, en mètres. La base ne
 *  bouge pas : l'amplitude croît du premier segment au dernier. */
export const TAIL_SWING = 0.009
/** Période du balancement, en secondes. Un chat au repos, pas un métronome. */
export const TAIL_PERIOD = 3.6
/** Décalage de phase d'un segment au suivant : c'est lui qui fait une ONDE
 *  plutôt qu'un bloc qui se translate. */
export const TAIL_PHASE = 0.55

/** Durée d'un clignement, en secondes — fermeture puis ouverture. */
export const BLINK_S = 0.16
/** Écart entre deux clignements, en secondes : tiré entre ces bornes. */
export const BLINK_GAP_MIN = 3.5
export const BLINK_GAP_MAX = 7.5
/** Ce qu'il reste de la hauteur de l'œil au plus fermé. Pas zéro : à zéro la
 *  paupière disparaît au lieu de se fermer, et on voit à travers la tête. */
export const BLINK_SQUASH = 0.06
