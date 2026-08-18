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

/**
 * Où les dossiers se rangent, dans le repère du tiroir FERMÉ.
 *
 * Le couloir n'est pas l'intérieur du tiroir : `Cabinet_Top` couvre `z` de
 * -2.500 à -1.950 à hauteur `y` 0.730-0.750, et le haut d'une étiquette est
 * déjà à 0.745. Un dossier rangé plus au fond aurait donc son étiquette dans
 * le plateau de la commode et ne pourrait pas se soulever au survol (#81).
 *
 * Ces bornes sont exprimées tiroir fermé — le groupe les emmène de +0.28 en
 * s'ouvrant, ce qui les amène de -1.930 à -1.710 : entièrement devant la
 * commode, donc libres de monter.
 */
export const FOLDER_Z_BACK = -2.21
export const FOLDER_Z_FRONT = -1.99

/**
 * L'étiquette : un plan de texte posé devant la face de `Folder_Tab`.
 *
 * Peindre dans la texture existante supposerait des UV faits pour ça — ceux de
 * `Folder_Tab` sont ceux d'un dépliage de bake. Un plan neuf donne des UV
 * maîtrisés et laisse le bake intact : il sert de fond papier au texte.
 *
 * 1.2 mm : assez pour ne pas se battre en profondeur avec la face de
 * l'étiquette, trop peu pour se voir décollé.
 */
export const LABEL_OFFSET_Z = 0.0012
export const LABEL_WIDTH = 0.088
export const LABEL_HEIGHT = 0.039

/** La texture de l'étiquette. 512 px pour 90 mm, dont 84 % utiles : le texte
 *  ne colle pas au bord du carton. Voir `TAB_LABEL_MAX_CHARS` pour la mesure. */
export const LABEL_TEXTURE_W = 512
export const LABEL_TEXTURE_H = 228
export const LABEL_SAFE_RATIO = 0.84

/** `--font-ui` du design system : les micro-étiquettes sont en Space Grotesk.
 *  La graisse et le corps final sont à trancher en session design (#78). */
export const LABEL_FONT_FAMILY = "'Space Grotesk', sans-serif"
export const LABEL_FONT_WEIGHT = 600
export const LABEL_FONT_PX = 66
/** Encre sur carton : un brun chaud, pas le `--ink` du verre fumé — celui-ci
 *  est un fond d'écran, il virerait au trou noir sur du papier crème. */
export const LABEL_INK = '#2B2418'
