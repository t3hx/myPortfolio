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
