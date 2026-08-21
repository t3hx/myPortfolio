/**
 * Runtime ink configuration — the 2D-stroke half of the Blender Line Art
 * match.
 *
 * Blender's Grease Pencil strokes are SCREEN-SPACE constant width and
 * artistically selective (edge marks, not every crease). These knobs bring
 * the runtime edges as close as possible; full fidelity comes from baking
 * the view-independent Line Art into the .glb (see the design doc).
 *
 * **L'encre se décide par MATÉRIAU, pas par objet** (#41, 2026-08-21) — la
 * même granularité que `RoomModel` utilise pour choisir ses traitements, et
 * pour la même raison. Une maille fusionnée mélange des surfaces qui n'ont
 * rien à voir : `Poster_Hellfest_Merged` porte le dessin ET son cadre. Exclue
 * par son nom d'objet, l'affiche emportait le cadre avec elle — or c'est le
 * cadre qui doit garder son trait, c'est lui l'objet. Le chargeur glTF monte
 * une maille par primitive, donc une maille = un matériau, et la question se
 * pose exactement là où la réponse diffère.
 */

/**
 * Stroke width in screen pixels. `?lw=` overrides it live.
 *
 * Grease Pencil tourne autour de 2 à 3 px, mais Blender encre une image fixe
 * et nous une pièce meublée : à 2,2 px le trait était plus large que la moitié
 * de ce qu'il cernait, et il fallait exclure objet après objet pour compenser
 * une épaisseur. La largeur est le premier réglage, la liste vient après.
 */
export const LINE_WIDTH_PX = 1.4

/** Ink color — near-black, matches the BD stroke of the UI direction. */
export const LINE_COLOR = '#10131f'

/** Crease angle threshold (degrees) for runtime edge extraction. */
export const LINE_THRESHOLD_DEG = 29

/**
 * Ce qui ÉMET de la lumière n'est jamais encré — dérivé, jamais listé.
 *
 * Dans un rendu cuit non éclairé, une surface émissive EST la lumière : il n'y
 * a pas de lampe ailleurs dans la scène qui l'expliquerait. Poser un trait
 * sombre de deux pixels sur une LED de deux pixels ne la souligne pas, il
 * l'éteint. `RoomModel` a déjà classé chaque matériau pour le rendre, et il
 * marque son choix dans `userData.runtime` : l'encre lit cette décision au
 * lieu de la refaire.
 *
 * La règle attrape d'un coup le rétroéclairage du clavier, les LED du casque
 * et du boîtier, les tuiles NanoLeaf, les yeux du chat, les ampoules — **les
 * étoiles et les cordes de guitare aussi**, qui étaient listées à la main
 * avant qu'on regarde de quoi elles étaient faites. Et elle couvre la LED que
 * le prochain export ajoutera.
 *
 * Elle décrit un RISQUE et non une interdiction : le trait n'éteint l'émissif
 * que lorsque celui-ci est plus petit que lui. Ce qui émet en grand le supporte
 * très bien — voir `INK_EMITTER_KEEP`, où le paysage et les hélices de
 * ventilateur sont nommés avec leur raison.
 */
export const INK_SKIP_EMITTERS = true

/**
 * Les émissifs qui gardent leur trait — deux familles, deux raisons.
 *
 * **Le décor du dehors** (`Mat_Mountains`, `Mat_Treeline`, `Mat_Ground`) se
 * sert de l'émissif comme d'un APLAT de peinture, pas comme d'une lampe : ce
 * sont des masses de paysage, pas des sources. Et leur silhouette est
 * précisément ce qui fait le paysage — c'est la crête cernée qui donne la
 * gravure dans la fenêtre.
 *
 * **Les pales de ventilateur** (`Mat_FanBlade`) sont le contre-exemple qui
 * montre que la règle dérivée décrit un RISQUE, pas une interdiction : un
 * trait sur un émissif l'éteint quand l'émissif est petit — une LED, une
 * étoile, une corde. Une hélice fait plusieurs centimètres, le trait en cerne
 * les branches au lieu de les recouvrir, et c'est ce qui donne au boîtier ses
 * dix roues dessinées. Arbitrage produit (2026-08-21), tranché sur capture.
 *
 * Le trait tourne AVEC la pale : `Outlines` attache ses lignes en enfant de la
 * maille, et `DeskAlive` fait tourner cette maille par transformation. C'est
 * la différence avec le rideau, dont les sommets partent dans un shader que
 * la géométrie du trait ne voit pas.
 */
export const INK_EMITTER_KEEP: readonly string[] = [
  'Mat_Mountains',
  'Mat_Treeline',
  'Mat_Ground',
  'Mat_FanBlade',
]

/**
 * Le trait est plus large que le motif qu'il devrait cerner.
 *
 * Là, l'encre ne souligne pas, elle remplace : la grille de l'ampli devient un
 * pâté, et le dessin d'une affiche se hache. **Le cadre des affiches n'est PAS
 * dans cette liste** — `Mat_PosterFrame` et `Mat_PosterFrame_H` gardent leur
 * trait, c'est tout l'intérêt de trancher par matériau.
 */
export const INK_SKIP_FINE: readonly string[] = [
  'Mat_Amp_Grille',
  'Mat_Amp_GrilleWire',
  'Mat_Poster_Hellfest',
  'Mat_Poster_Expanse',
  'Mat_AmpText', // décalque à canal alpha : le trait cerne le quad, pas le logo
]

/**
 * Géométrie dense dont les plis, cernés, virent au grillage.
 *
 * La lune est une sphère facettée vue de très près : chaque facette passe le
 * seuil d'angle, et le trait en fait un fil de fer. Le ciel est une voûte
 * fermée dont on ne veut aucune arête.
 */
export const INK_SKIP_DENSE: readonly string[] = ['Mat_Moon', 'Mat_MoonDetailed', 'Mat_Sky']

/**
 * Géométrie que l'encre ne peut pas suivre.
 *
 * `EdgesGeometry` est construite UNE FOIS, sur la pose au repos ; `Curtains`
 * (#38) déplace ses sommets dans le vertex shader. Le trait reste donc là où
 * le tissu n'est plus — mesuré à l'arrêt Télescope, il décroche et pend à une
 * quinzaine de pixels en plein ciel. Aucune capture en `prefers-reduced-motion`
 * ne peut le montrer, et c'est le mode dans lequel tourne toute la boucle de
 * comparaison.
 */
export const INK_SKIP_DEFORMED: readonly string[] = ['Mat_Curtain']

/**
 * Le repli par NOM D'OBJET, gardé vide.
 *
 * Il reste parce qu'un jour deux objets partageront un matériau et devront
 * être traités différemment — c'est le seul cas que le matériau ne sait pas
 * dire. Les cinq entrées qu'il portait ont toutes trouvé leur matériau ; les
 * y laisser aurait été deux mécanismes pour une question.
 *
 * La correspondance se fait par SOUS-CHAÎNE, sur l'objet ou n'importe lequel
 * de ses parents, et c'est un piège tendu : `Window_Curtain_` ne doit pas
 * attraper `Window_CurtainRod_Pole`. `tests/lineArt.test.ts` le verrouille.
 */
export const LINE_OVERRIDES: Record<string, number> = {}

/** Pourquoi une maille n'est pas encrée. `null` = elle l'est. */
export type InkSkip = 'emitter' | 'fine' | 'dense' | 'deformed' | 'node' | null

/**
 * La décision d'encre pour une maille, et sa RAISON.
 *
 * Rendre la raison plutôt qu'un booléen est ce qui rend la liste curable : la
 * sonde `window.__inkDebug` affiche ce qui a été sauté et pourquoi. C'est un
 * inventaire de TOUTE la scène, pris une fois au montage — pas un relevé par
 * arrêt, la traversée ne sait pas ce que la caméra cadre. Une liste
 * d'exclusions qu'on ne peut pas relire finit par contenir des entrées que
 * plus personne ne sait justifier.
 */
export function inkSkipReason(
  materialName: string | undefined,
  runtime: string | undefined,
  nodeName = '',
  parents: readonly string[] = [],
): InkSkip {
  const mat = materialName ?? ''
  if (INK_SKIP_FINE.includes(mat)) return 'fine'
  if (INK_SKIP_DENSE.includes(mat)) return 'dense'
  if (INK_SKIP_DEFORMED.includes(mat)) return 'deformed'
  if (INK_SKIP_EMITTERS && runtime === 'emissive' && !INK_EMITTER_KEEP.includes(mat))
    return 'emitter'
  if (lineFactor(nodeName, parents) === 0) return 'node'
  return null
}

/**
 * Le facteur d'encre d'un objet par son NOM : 0 = pas de trait, 1 = trait.
 *
 * Vit ici et pas dans `Outlines.tsx` pour être testable — `Outlines.tsx` tire
 * three et R3F. Premier match gagnant.
 */
export function lineFactor(name: string, parents: readonly string[] = []): number {
  for (const [match, factor] of Object.entries(LINE_OVERRIDES)) {
    if (name.includes(match) || parents.some((p) => p.includes(match))) return factor
  }
  return 1
}

/** Inverted-hull silhouette thickness (world units). */
export const HULL_THICKNESS = 0.0028

export function lineWidthFromUrl(): number {
  if (typeof window === 'undefined') return LINE_WIDTH_PX
  const raw = new URLSearchParams(window.location.search).get('lw')
  const parsed = raw ? Number.parseFloat(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 12 ? parsed : LINE_WIDTH_PX
}
