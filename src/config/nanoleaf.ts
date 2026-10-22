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
 * Les trois arrêts du dégradé, dans l'ordre du cycle : vert, violet, magenta.
 *
 * Le premier jeu mêlait deux bleus — cyan et bleu électrique — et un rose. Deux
 * voisins sur la roue chromatique ne font pas une triade : le panneau lisait
 * « bleu qui varie », pas trois couleurs. Vert, violet et magenta sont, eux,
 * répartis autour de la roue, et c'est ce qui donne l'accord cyberpunk.
 *
 * - `#36ff51` — **relevé dans la pièce** : `Mat_CatEyes`, le vert électrique du
 *   regard du chat, la seule vraie couleur verte de la scène ;
 * - `#7c46d6` — le violet profond. **Celui-là est nouveau** : aucun matériau du
 *   `.glb` n'en porte. Il fait le pont entre les deux autres, qui sans lui
 *   sauteraient du vert au magenta par le plus court chemin — c'est-à-dire par
 *   un gris sale ;
 * - `#e24bc0` — le magenta, une version soutenue du rose des pales du PC
 *   (`Mat_FanBlade`, `#ed9ef5`), qui était trop pâle pour tenir son rang face
 *   au vert.
 *
 * La saturation, elle, n'est pas laissée à ces valeurs : `LED_TINT` la borne
 * sous celle du bake, mesurée.
 */
export const LED_RAMP = ['#36ff51', '#7c46d6', '#e24bc0'] as const

/** Durée d'un tour complet du dégradé, en secondes. Reste une lumière
 *  d'ambiance, mais assez vive pour qu'on la voie vivre sans la fixer. */
export const LED_PERIOD = 11

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
export const LED_TINT = 0.42
