/**
 * Les réglages du site classique (#29).
 *
 * Tous mesurés par la session design et consignés dans
 * `docs/PORTFOLIO_2D.md`, qui fait foi. Ils vivent ici plutôt que dans les
 * composants parce que c'est ce qui les rend relisables ensemble : une
 * animation se juge à côté des autres, pas au milieu du JSX qui la porte.
 *
 * Ce qui est en CSS y reste (les fondus, les glissements, les cascades de
 * révélation) ; ce fichier ne tient que les nombres dont le JavaScript a
 * besoin — ceux des deux boucles `requestAnimationFrame` et du déchiffrage.
 */

/* ===== Déchiffrage du nom (spec §1) ===== */

/** Le silence avant que le nom commence à se résoudre. Il laisse la page
 *  arriver : sans lui, le déchiffrage est déjà commencé au premier rendu et on
 *  ne voit que sa fin. */
export const NAME_DECRYPT_DELAY_MS = 350

/** Doit égaler `--t-classic-decrypt` de classic.css —
 *  `tests/classic.test.ts` est la seule chose qui relie les deux. */
export const NAME_DECRYPT_MS = 1700

/** Période de tirage d'un glyphe. Plus lente que celle du CV de la scène
 *  (40 ms) : le nom d'accueil est deux fois plus grand, et à cette taille un
 *  tirage trop rapide scintille au lieu de crépiter. */
export const NAME_DECRYPT_FRAME_MS = 45

/* ===== Cube filaire de l'accueil (spec §4) ===== */

/**
 * La vitesse de rotation, en degrés par seconde, selon la distance du curseur
 * au centre du cube.
 *
 * **Le cube ralentit quand on l'approche** — c'est le sens qui compte et il
 * est contre-intuitif à écrire, évident à voir : on regarde ce qui se calme
 * quand on s'en approche. Un cube qui s'emballe sous le curseur fuirait.
 */
export const CUBE_SPEED_NEAR = 7
export const CUBE_SPEED_FAR = 62

/** La vitesse tant qu'aucune souris ne s'est manifestée — un tactile, un
 *  clavier, une page qu'on vient d'ouvrir sans bouger. Entre les deux bornes :
 *  le cube tourne, sans prétendre répondre à personne. */
export const CUBE_SPEED_IDLE = 26

/**
 * L'assiette du cube au repos, en degrés autour de Y.
 *
 * **Elle existe pour le mouvement réduit**, où la boucle est coupée et où le
 * cube reste sur cette pose définitivement. À 0° on ne voit que quatre faces
 * de profil et une perspective forte : ça se lit comme un tronc de pyramide,
 * pas comme un cube. À 28° deux faces sont visibles à des largeurs
 * différentes, et le volume se lit d'un coup.
 *
 * C'est aussi l'angle de départ de la boucle, sinon le cube afficherait la
 * pose de repos puis sauterait à 0° à la première image.
 *
 * Doit égaler le `rotateY` de `.classic-cube` dans `classic.css` —
 * `tests/classic.test.ts` est la seule chose qui relie les deux.
 */
export const CUBE_REST_DEG = 28

/** Lissage de la vitesse, par image. À 1 le cube change de régime d'un coup au
 *  moindre mouvement ; à 0,05 il met environ une demi-seconde à suivre, ce qui
 *  se lit comme une inertie de volant plutôt que comme un asservissement. */
export const CUBE_SPEED_LERP = 0.05

/** Plafond du delta de temps, en secondes. Un onglet en arrière-plan ne reçoit
 *  plus d'images : au retour, un `dt` de plusieurs secondes ferait faire au
 *  cube un demi-tour instantané. */
export const CUBE_MAX_DT_S = 0.05

/** Parallaxe du cube au mouvement de souris, en pixels, aux bords du viewport.
 *  Négatifs : le cube s'écarte du curseur — c'est ce décalage contraire qui
 *  crée la profondeur, un cube qui suit la souris se collerait à la vitre. */
export const CUBE_PARALLAX_X = -18
export const CUBE_PARALLAX_Y = -14

/* ===== Halo de braise (spec §7) ===== */

/**
 * La hauteur de la nappe, en fraction du viewport.
 *
 * **C'est une course, pas une taille.** Le halo doit rester visible du haut au
 * bas de la page : à 2,05 viewports il affleure le bas de l'accueil au
 * chargement et atteint le haut de l'écran en fin de page. Le réduire fait
 * sortir le halo par le haut avant la fin ; l'augmenter le fige, parce que sa
 * course devient plus longue que le défilement qui la commande.
 */
export const HALO_SHEET_VH = 2.05

/**
 * Lissage du halo, par image — **le réglage le plus sensible de la page**.
 *
 * À 0,02, le halo continue de glisser plusieurs secondes après l'arrêt du
 * défilement : c'est cette traîne qui le fait lire comme une braise dans la
 * pièce plutôt que comme un calque attaché au scroll. Le monter le colle au
 * défilement et il disparaît en tant qu'effet ; le baisser le décroche au
 * point qu'il n'est plus jamais là où on est.
 */
export const HALO_LERP = 0.02

/* ===== Révélations au défilement (spec §6) ===== */

/**
 * La marge haute de l'`IntersectionObserver`, **obligatoire et énorme**.
 *
 * Elle ne règle pas le déclenchement, elle règle le RATTRAPAGE : sans elle,
 * une section dépassée d'un coup — défilement rapide, touche Fin, un lien
 * d'ancre — n'entre jamais dans le champ de l'observateur et reste
 * définitivement invisible, à `opacity: 0`. Avec 9999 px au-dessus, tout ce
 * qui est passé est déjà « en vue » et se révèle en même temps.
 */
export const REVEAL_ROOT_MARGIN = '9999px 0px -10% 0px'

/** Les retards intra-groupe, en millisecondes (spec §6). Ils descendent
 *  l'écran dans l'ordre de lecture : le kicker, le titre, puis le contenu. */
export const REVEAL_KICKER_MS = 0
export const REVEAL_TITLE_MS = 90
export const REVEAL_BODY_MS = 180

/** Le pas d'un item à l'autre, par famille. Ils diffèrent parce que les objets
 *  n'ont pas la même taille : une cartouche fait une ligne du regard, une
 *  vignette un coup d'œil — le même pas ferait traîner l'une ou hacher l'autre. */
export const REVEAL_STEP_CARD_MS = 110
export const REVEAL_STEP_TILE_MS = 45
export const REVEAL_STEP_PROJECT_MS = 120

/** Le départ des familles qui suivent un titre. */
export const REVEAL_TILE_BASE_MS = 90
export const REVEAL_CHIP_BASE_MS = 80
export const REVEAL_PROJECT_BASE_MS = 180
