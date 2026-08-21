/**
 * Le dégradé animé des tuiles NanoLeaf (issue #36).
 *
 * **Les trois couleurs existent déjà dans la pièce**, et c'est ce qui fait que
 * l'animation a l'air native plutôt que collée dessus. Aucune n'est inventée :
 * elles sont relevées sur les matériaux émissifs du `.glb`, à la pipette.
 *
 * La tuile au repos est `Mat_LEDEmissive`, `#6699ff` — un bleu qui tombe pile
 * entre le bleu du clavier et le cyan des LED. Le dégradé ne fait donc pas
 * entrer une palette étrangère : il promène celle de la pièce.
 */

/** Le panneau, un seul objet fusionné de 14 tuiles TRIANGULAIRES. */
export const LED_TILES_OBJECT = 'LEDTiles_Merged'
/** Le matériau à moduler, et lui seul. */
export const LED_TILES_MATERIAL = 'Mat_LEDEmissive'

/**
 * Les trois arrêts du dégradé, dans l'ordre du cycle.
 *
 * - `#ed9ef5` — `Mat_FanBlade`, le rose-violet qui sort du boîtier du PC ;
 * - `#4dd9ff` — `Mat_MonitorStatusLED`, `Mat_HeadsetLED`, `Mat_GuitarString` :
 *   le cyan de toutes les LED de la pièce, cousin de l'accent `--glow` ;
 * - `#4da6ff` — `Mat_KeyboardBacklight`, le bleu électrique du clavier.
 *
 * Elles sont désaturées par le bake lui-même, donc « cyberpunk » sans être
 * criardes : c'est la pièce qui a déjà fait ce réglage, pas nous.
 */
export const LED_RAMP = ['#ed9ef5', '#4dd9ff', '#4da6ff'] as const

/** Durée d'un tour complet du dégradé, en secondes. Lent : c'est une lumière
 *  d'ambiance, pas un gyrophare. */
export const LED_PERIOD = 16

/**
 * Nombre de cycles visibles simultanément sur le panneau.
 *
 * À 1, les 14 tuiles parcourent la rampe entière et deux tuiles voisines sont
 * très différentes. À 0,45, la vague est plus longue que le panneau : les
 * voisines se ressemblent, et c'est ce qui donne le dégradé « doux » plutôt
 * qu'un arc-en-ciel.
 */
export const LED_SPREAD = 0.45

/**
 * Force de la teinte, entre 0 et 1.
 *
 * **La teinte change la couleur, jamais la luminosité.** La première version
 * multipliait le bake par la teinte puis rehaussait le tout : les canaux
 * débordaient, le panneau devenait plus lumineux que ce que Blender avait cuit,
 * et les couleurs viraient au criard — exactement ce qu'il fallait éviter. La
 * teinte est maintenant ramenée à la luminance du bake avant d'être mélangée :
 * seule la couleur se déplace, la clarté du panneau ne bouge pas d'un pouce.
 *
 * **0,5 est mesuré, pas choisi.** Le critère : le dégradé peut déplacer la
 * teinte, mais le panneau ne doit jamais devenir PLUS saturé que ce que Blender
 * a cuit. Saturation moyenne des pixels de tuile, mesurée à l'arrêt Bureau —
 * bake 0,33 ; à 0,8 elle monte à 0,353, au-dessus du bake, et le magenta vire
 * au rose criard ; à 0,5 elle retombe à 0,306, sous le bake. La luminosité,
 * elle, ne bouge pas (217 contre 218) par construction.
 */
export const LED_TINT = 0.5
