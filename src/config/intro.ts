/**
 * L'intro « Triangle » (issue #127) : ce qui la pose sur l'écran principal.
 *
 * Le vocabulaire est fixé dans CONTEXT.md — écran principal, dernière image,
 * geste de saut. Ici ne vivent que les nombres et les noms que le code lit.
 */

/**
 * Le matériau de la surface d'écran, dans le `.glb`. Un seul matériau sur une
 * seule primitive de huit sommets, qui couvre les DEUX moniteurs — l'horizontal
 * et le vertical. C'est `findScreenPlane` qui sépare les deux, en choisissant
 * la face que la caméra Home regarde.
 */
export const SCREEN_MATERIAL = 'Mat_MonitorScreen'

/** L'arrêt dont la caméra désigne l'écran principal, par son `label`. */
export const INTRO_HOME_STOP = 'Home'

/**
 * Le cadre de la composition, en pixels du design : l'animation a été
 * chorégraphiée dans un 1920 × 1080, et toutes ses positions y sont écrites.
 * Ce cadre est posé ENTIER sur l'écran — contenu et centré, jamais rogné ni
 * étiré (décision du 2026-09-05).
 */
export const INTRO_FRAME = { width: 1920, height: 1080 } as const

/**
 * Le cadre est contenu dans CE QUE LE VISITEUR VOIT À HOME, pas dans l'écran.
 *
 * Les deux ne coïncident qu'en 16:9. Le cadrage Home est un `fit: contain`
 * (#135) : sur une fenêtre plus haute (16:10, un MacBook) il rogne les côtés
 * de l'écran, sur une plus large (21:9) le haut et le bas. Mesuré à 1440×900,
 * un cadre dimensionné sur l'écran débordait de la fenêtre de 2,5 % de chaque
 * côté — l'animation aurait perdu ses bords sans que rien ne le dise.
 *
 * La marge est donc une fraction de la HAUTEUR de la fenêtre à Home, laissée
 * libre des quatre côtés du cadre. Un seul réglage, à ajuster à l'écran.
 */
export const INTRO_SCREEN_MARGIN = 0.03

/**
 * Ce que la barre de menu réserve sur le bord DROIT de la fenêtre, en px :
 * sa largeur plus son retrait du bord (`.menu` dans tokens.css — 52 + 12).
 * La barre ne doit gêner en rien la lecture de l'animation (décision du
 * 2026-09-05) : le cadre s'arrête avant elle, et comme il reste centré sur
 * l'écran, la même réserve vaut à gauche. `tests/introScreen.test.ts` échoue
 * si les tokens et ce nombre divergent.
 */
export const INTRO_SAFE_INSET_PX = 64
