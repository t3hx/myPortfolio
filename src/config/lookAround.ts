/**
 * Le regard autour du sujet — les réglages.
 *
 * À l'arrêt, la souris portée à gauche ou à droite fait ORBITER la caméra de
 * quelques degrés autour du sujet, qui reste centré. Ce n'est pas un
 * panoramique : une caméra qui pivoterait sur place chasserait le sujet hors du
 * cadre, ce qui est l'inverse de ce qu'on demande à un regard.
 *
 * Les valeurs sont ici et la géométrie dans `src/lib/lookAround.ts` — même
 * partage que `gesture.ts` et `stops.ts`, pour que la règle se vérifie sans
 * navigateur.
 */

/**
 * L'amplitude, exprimée en FRACTION DU CHAMP de l'arrêt, jamais en degrés
 * fixes.
 *
 * Ce qui se lit comme « un peu » n'est pas un angle, c'est la part du cadre qui
 * bouge : le fond se déplace de `yaw / hfov` de la largeur. Or le tour va de
 * 27° au CV à 84° sur la guitare — un même 5° y serait trois fois plus visible
 * d'un arrêt à l'autre. La dérivation est de la même espèce que le stockage
 * horizontal du champ : on garde l'invariant perceptif, on recalcule le reste.
 */
export const LOOK_MAX_FRAC = 0.09

/**
 * Le plafond, en degrés — parce que l'amplitude relative ne borne PAS le
 * déplacement réel.
 *
 * La caméra parcourt un arc de `rayon × angle` : sur un arrêt large et
 * lointain, 9 % du champ font des dizaines de centimètres, assez pour entrer
 * dans un mur. Le plafond garde la même sensation partout sans laisser la
 * caméra sortir de la pièce.
 */
export const LOOK_MAX_DEG = 6

/**
 * La zone morte au centre, en fraction de la demi-largeur.
 *
 * **Sans elle, le cadrage composé dans Blender n'existe à aucun moment** — il
 * ne serait atteint que si le curseur tombait exactement sur la colonne
 * centrale, au pixel près. Avec elle, il y a une plage où la caméra se tient
 * tranquille, et c'est celle-là qu'on voit en arrivant.
 */
export const LOOK_DEADZONE = 0.08

/**
 * Le lissage, par image. Le curseur saute d'un bord à l'autre en une image ;
 * la caméra, non. À 0,08 elle rejoint sa cible en une demi-seconde environ —
 * assez pour qu'on sente qu'on la pousse, pas assez pour qu'on l'attende.
 */
export const LOOK_LERP = 0.08

/** En deçà, on considère le regard revenu au centre : `applyPose` reprend la
 *  pose telle quelle et l'orbite ne coûte plus rien. */
export const LOOK_EPSILON_DEG = 0.01
