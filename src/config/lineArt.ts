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
}

/** Inverted-hull silhouette thickness (world units). */
export const HULL_THICKNESS = 0.0028

export function lineWidthFromUrl(): number {
  if (typeof window === 'undefined') return LINE_WIDTH_PX
  const raw = new URLSearchParams(window.location.search).get('lw')
  const parsed = raw ? Number.parseFloat(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 12 ? parsed : LINE_WIDTH_PX
}
