/**
 * Les rideaux dans la brise (issue #38).
 *
 * **Le budget d'amplitude est étroit, et c'est mesuré.** La boîte englobante du
 * rideau gauche chevauche déjà celle du télescope de 7,8 cm en Z, et les deux
 * partagent la même plage en X : un souffle un peu large ferait traverser
 * l'instrument par le tissu. C'est ce qui fixe `CURTAIN_SWAY`, pas le goût.
 *
 * Géométrie relevée sur l'export : chaque rideau fait 288 sommets, 2,45 m de
 * haut (y −1,225 → 1,225 en local), 35 cm de large (z), et 4,3 cm d'épaisseur
 * (x). L'épaisseur est donc l'axe du souffle — le tissu entre et sort de la
 * pièce, il ne coulisse pas le long de la tringle.
 */

export const CURTAIN_OBJECTS = ['Window_Curtain_Left', 'Window_Curtain_Right'] as const
/** Le matériau partagé par les deux — un seul point d'injection. */
export const CURTAIN_MATERIAL = 'Mat_Curtain'

/** Hauteur locale du haut du rideau, là où il est accroché à la tringle. */
export const CURTAIN_TOP = 1.225
/** Hauteur locale du bas, l'ourlet libre. */
export const CURTAIN_BOTTOM = -1.225

/**
 * Débattement de l'ourlet PERPENDICULAIREMENT au tissu, en mètres — le souffle
 * qui entre et sort de la pièce.
 *
 * Vérifié en capture à l'arrêt Télescope, où le rideau droit et l'instrument se
 * côtoient : à 9 cm le tissu ne l'atteint pas.
 */
export const CURTAIN_SWAY = 0.09

/**
 * Débattement LATÉRAL de l'ourlet, le long de la tringle, en mètres.
 *
 * **C'est lui qui rend le mouvement visible, et il a fallu le mesurer pour s'en
 * apercevoir.** À l'arrêt Télescope la caméra regarde vers la fenêtre, donc
 * PRESQUE DANS L'AXE du souffle : à 9 cm de débattement perpendiculaire, la
 * silhouette du rideau ne bougeait pas d'un pixel, seul son ombrage changeait.
 * Un vrai rideau ne fait pas que gonfler, son ourlet balance aussi le long de
 * la tringle — et c'est cette composante-là qui se lit de face.
 *
 * Plus petite que la perpendiculaire : un tissu suspendu résiste davantage au
 * balancement latéral qu'au gonflement. Et elle est bornée par la même
 * contrainte — le télescope n'est qu'à 7,8 cm.
 */
export const CURTAIN_DRIFT = 0.035

/** Période de la houle principale, en secondes. Lent et régulier — une brise,
 *  pas une rafale. */
export const CURTAIN_PERIOD = 7.5
/** Période de la seconde houle, volontairement non multiple de la première :
 *  deux ondes commensurables se rejoindraient périodiquement et le mouvement
 *  se mettrait à battre la mesure. */
export const CURTAIN_PERIOD_2 = 4.9

/** Nombre d'ondulations sur la largeur du rideau. Moins d'une : le tissu se
 *  creuse d'un seul côté à la fois, comme une vraie chute de tissu lestée. */
export const CURTAIN_WAVES = 0.8
