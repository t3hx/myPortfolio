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

/**
 * Le survol d'un dossier (#81).
 *
 * Il monte **et** avance : au spike, un dossier qui monte seulement masque
 * complètement son voisin de derrière — le geste censé désigner une fiche en
 * cachait une autre (`docs/renders/spikes/cabinet-hover-label.png`).
 *
 * 0.05 en `y` suffit à dégager l'étiquette au-dessus de ses voisines ; le
 * couloir en Z garantit qu'il n'y a rien au-dessus pour l'arrêter.
 */
export const HOVER_LIFT_Y = 0.05
export const HOVER_SHIFT_Z = 0.02
export const HOVER_TWEEN_S = 0.22
export const HOVER_EASE = 'power2.out'

/**
 * L'encre du contour : `--glow` du design system, l'accent froid des cordes,
 * du clavier et des yeux du chat. Validé en capture — il tranche franchement
 * sur le bois chaud de la commode.
 *
 * La largeur est en PIXELS ÉCRAN, comme le mode `edges` d'`Outlines` : un
 * contour dont l'épaisseur varierait avec la distance ne se lirait plus comme
 * un trait mais comme une partie de l'objet.
 */
export const HOVER_OUTLINE_COLOR = '#8FDBE4'
export const HOVER_OUTLINE_WIDTH_PX = 2.4
/** Seuil d'angle des arêtes gardées : au-delà, on encre aussi le maillage. */
export const HOVER_OUTLINE_THRESHOLD_DEG = 30

/**
 * Le vol du dossier vers la caméra (#82).
 *
 * Le dossier **grandit, il ne s'ouvre pas** : ses pièces sont des boîtes
 * séparées de 1.5 mm, pas des rabats articulés, et leurs faces internes n'ont
 * aucun bake pour un état ouvert. Le dépliage est une illusion que le panneau
 * DOM (#83) prend en charge, en fondu, quand le dossier remplit le cadre.
 */
export const FLIGHT_DURATION_S = 0.85
export const FLIGHT_EASE = 'power3.inOut'
export const FLIGHT_RETURN_EASE = 'power2.inOut'

/**
 * Plancher devant le plan proche : un dossier qui remplit le cadre s'approche
 * beaucoup, et rien ne doit finir tranché par le clipping.
 *
 * 1.2 et pas davantage : ce plancher est un garde-fou, pas une politique de
 * cadrage. Trop haut, il l'emporte sur le calcul de remplissage et le dossier
 * s'arrête trop loin — mesuré, à 2.5 il laissait voir la pièce dès les champs
 * larges du tour. Il ne doit se déclencher que pour un objet absurdement
 * petit, jamais pour un dossier.
 */
export const FLIGHT_NEAR_MARGIN = 1.2

/** Le dossier déborde un peu plutôt que d'affleurer. Un remplissage calculé au
 *  plus juste fait coïncider ses bords avec ceux du cadre, et le moindre
 *  arrondi y laisse voir un liseré de pièce — mesuré, en haut et à gauche. */
export const FLIGHT_FILL_MARGIN = 1.08
