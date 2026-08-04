import { CAMERA_STOPS } from '@/config/cameraStops'

/**
 * URL-driven view modes, ported from the Vue prototype:
 *
 *   /              -> 'default'  (production view)
 *   /?debug        -> 'tour'     (diagnostic HUD)
 *   /?debug-fly    -> 'fly'      (free first-person navigation — NOT in the spike)
 *
 * Mode is resolved once at module load — switching modes is a page reload, by design.
 */
export type ViewMode = 'default' | 'tour' | 'fly'

function resolve(): ViewMode {
  if (typeof window === 'undefined') return 'default'
  const params = new URLSearchParams(window.location.search)
  if (params.has('debug-fly')) return 'fly'
  if (params.has('debug')) return 'tour'
  return 'default'
}

export const viewMode: ViewMode = resolve()

/**
 * Optional `?stop=<label>` deep-link — snaps the camera to that stop on load.
 * Used by the Playwright render-comparison loop (deterministic framing vs
 * docs/renders/refs/) and shareable URLs. Matches the friendly label,
 * case-insensitive, prefix allowed ('bookshelf' → 'BookshelfPlant').
 * Returns the stop index, or null.
 */
export function stopParamIndex(): number | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('stop')?.toLowerCase()
  if (!value) return null
  const index = CAMERA_STOPS.findIndex(
    (s) => s.label.toLowerCase() === value || s.label.toLowerCase().startsWith(value),
  )
  return index === -1 ? null : index
}
