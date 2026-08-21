/**
 * Runtime ink configuration — the 2D-stroke half of the Blender Line Art
 * match (per-object overrides pattern, like the legacy light overrides).
 *
 * Blender's Grease Pencil strokes are SCREEN-SPACE constant width and
 * artistically selective (edge marks, not every crease). These knobs bring
 * the runtime edges as close as possible; full fidelity comes from baking
 * the view-independent Line Art into the .glb (see the design doc).
 */

/** Stroke width in screen pixels (Grease Pencil feel: 2-3px). `?lw=` overrides. */
export const LINE_WIDTH_PX = 2.2

/** Ink color — near-black, matches the BD stroke of the UI direction. */
export const LINE_COLOR = '#10131f'

/** Crease angle threshold (degrees) for runtime edge extraction. */
export const LINE_THRESHOLD_DEG = 29

/**
 * Per-object line exclusions/tuning, matched by name substring (first match
 * wins): 0 = no ink on this object, 1 = default. Values other than 0/1 are
 * reserved for per-object width once material grouping lands.
 *
 * Curate against the refs: Blender inks selectively — kill the ink where the
 * ref keeps surfaces clean.
 */
export const LINE_OVERRIDES: Record<string, number> = {
  Moon: 0, // dense sphere → wireframe hash
  Sky: 0,

  // La liste de curation de #41. Chacune de ces entrées répare un endroit où
  // le trait est PLUS LARGE que ce qu'il cerne : à 2,2 px, l'encre ne souligne
  // plus l'objet, elle le remplace.
  //
  // `Outside_Stars` est l'exemple qui décide : `Sky: 0` couvrait bien
  // `Outside_Sky`, mais les étoiles sont un nœud SÉPARÉ, et chacune fait deux
  // pixels. Cernées, elles devenaient des points NOIRS — le ciel nocturne de
  // l'arrêt Télescope se retrouvait criblé à l'envers.
  Outside_Stars: 0,
  Guitar_Strings: 0, // six cordes cyan → une bouillie sombre
  Prop_Keyboard_Keys: 0, // les touches se rejoignent en un bloc plein
  Poster_: 0, // l'affiche est une maille fusionnée : le trait hache le dessin

  // Les rideaux, pour une raison DIFFÉRENTE des quatre entrées ci-dessus :
  // ici le trait n'est pas trop large, il est au mauvais endroit. `Curtains`
  // (#38) déplace les sommets dans le VERTEX SHADER, alors qu'`EdgesGeometry`
  // est construite une fois, sur la géométrie au repos. L'encre ne peut pas
  // suivre : mesuré à l'arrêt Télescope, elle décroche du tissu et reste
  // pendue en plein ciel, à une quinzaine de pixels.
  //
  // Aucune capture en `prefers-reduced-motion` ne pouvait le montrer — la
  // brise y est coupée, et c'est le mode dans lequel tourne toute la boucle de
  // comparaison. Le `Window_CurtainRod_*`, lui, garde son trait : la tringle
  // ne bouge pas, et `Window_Curtain_` ne l'attrape pas.
  Window_Curtain_: 0,
}

/**
 * Le facteur d'encre d'un objet : 0 = pas de trait, 1 = trait par défaut.
 *
 * La correspondance se fait par SOUS-CHAÎNE, sur le nom de l'objet ou sur
 * celui de n'importe lequel de ses parents — une maille fusionnée porte
 * rarement le nom qu'on a en tête, et `Poster_` doit attraper les deux
 * affiches sans qu'on les liste. Premier match gagnant.
 *
 * Vit ici et pas dans `Outlines.tsx` pour être testable : la liste de curation
 * est la seule partie du contour qu'une régression peut casser en silence —
 * un ré-export qui renomme `Outside_Stars` recriblerait le ciel de points
 * noirs sans qu'aucun outil ne bronche.
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
