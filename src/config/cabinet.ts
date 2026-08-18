/**
 * Le tiroir du haut de la commode (issue #76).
 *
 * Spec : `docs/SPEC_CABINET_PROJECTS.md`. Les noms viennent du `.glb` et sont
 * la seule chose que Blender impose ici — l'amplitude et l'axe, eux, ont été
 * mesurés sur l'export v13 :
 *
 *   façade du tiroir  z = -1.951      fond du tiroir  z = -2.479
 *   caméra de l'arrêt z = -0.87       → l'ouverture se fait vers +Z
 *
 * L'amplitude de 0.28 est celle qui reproduit le rendu de référence Blender
 * (`docs/renders/refs/cabinet.png`), vérifiée en capture :
 * `docs/renders/spikes/cabinet-drawer-open.png`.
 */

/** `label` de l'arrêt qui commande l'ouverture — clé de `CAMERA_STOPS`. */
export const DRAWER_STOP_LABEL = 'Cabinet'

/** Nom du groupe fabriqué au runtime. Le `.glb` n'en contient aucun : son
 *  graphe est PLAT (157 nœuds, tous racines de la scène). */
export const DRAWER_GROUP_NAME = 'Cabinet_TopDrawer_Group'

/** Course d'ouverture, en mètres, le long de +Z. */
export const DRAWER_OPEN_Z = 0.28

/** Durée et courbe du coulissement. Un tiroir décélère en butée, il ne rebondit
 *  pas : `power2.out` et rien d'autre. */
export const DRAWER_TWEEN_S = 0.9
export const DRAWER_EASE = 'power2.out'

/** La caisse du tiroir. Seul celui du haut a un intérieur modélisé — les deux
 *  autres n'ont qu'une façade et leurs poignées, et ne s'ouvrent pas. */
export const DRAWER_PART_NAMES = [
  'Cabinet_TopDrawer_Front',
  'Cabinet_TopDrawer_Back',
  'Cabinet_TopDrawer_Bottom',
  'Cabinet_TopDrawer_LSide',
  'Cabinet_TopDrawer_RSide',
  'Cabinet_TopDrawer_HandleBar',
  'Cabinet_TopDrawer_HandlePost_L',
  'Cabinet_TopDrawer_HandlePost_R',
] as const

/** Ce que le tiroir emporte avec lui. Le `.glb` ne contient qu'UN dossier ; les
 *  clones, un par projet, sont l'objet de #80 et rejoindront le même groupe. */
export const DRAWER_CONTENT_NAMES = [
  'Folder_Back',
  'Folder_Front',
  'Folder_Page',
  'Folder_Tab',
] as const

/** Sans la façade, il n'y a pas de tiroir à faire coulisser : c'est la seule
 *  pièce dont l'absence annule l'interaction au lieu de la dégrader. */
export const DRAWER_REQUIRED_PART = 'Cabinet_TopDrawer_Front'

/**
 * Combien de dossiers le tiroir peut porter.
 *
 * Les dossiers doivent tous tenir dans le couloir `z > -1.950` — les 0.28 m que
 * le tiroir sort — sinon leur étiquette entre dans le plateau de la commode et
 * ils ne peuvent plus se soulever au survol (#81). À cinq, le pas tombe à
 * 0.055 m, ce qui reste confortable à viser à la souris ; au-delà, les dossiers
 * du fond deviennent des cibles trop serrées.
 */
export const DRAWER_CAPACITY = 5

/**
 * Ce qu'une étiquette de dossier peut porter comme texte.
 *
 * Mesuré, pas estimé : la texture d'étiquette fait 512 px de large pour 90 mm,
 * dont 430 utiles une fois la marge de 8 % retirée. À 78 px de fonte,
 * « Portfolio » (9 signes) occupe 360 px et passe, « myPortfolio » (11) en
 * réclame 483 et déborde ; à 66 px, 11 signes passent (409 px). « Celestial
 * Walker » (16) ne tient à aucune taille lisible.
 *
 * Le compte de signes n'est qu'un garde-fou — onze « M » sont plus larges que
 * onze « i ». #80 doit **en plus** réduire la fonte jusqu'à ce que le texte
 * entre ; ce plafond sert à ce qu'aucun libellé n'arrive jusque-là.
 */
export const TAB_LABEL_MAX_CHARS = 11
