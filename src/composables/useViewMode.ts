/**
 * URL-driven view modes for the portfolio scene.
 *
 *   /              -> 'default'  (production view: scene only, no HUD, no fly controls)
 *   /?debug        -> 'tour'     (guided camera tour with HUD buttons — dev/diagnostic)
 *   /?debug-fly    -> 'fly'      (free first-person navigation, no HUD — dev/diagnostic)
 *
 * Mode is resolved once at module load — switching modes is a page reload, by design.
 * That keeps the canvas/camera lifecycle simple (no mid-session swap of control rigs).
 */
export type ViewMode = 'default' | 'tour' | 'fly'

function resolve(): ViewMode {
  if (typeof window === 'undefined') return 'default'
  const params = new URLSearchParams(window.location.search)
  if (params.has('debug-fly')) return 'fly'
  if (params.has('debug')) return 'tour'
  return 'default'
}

const mode: ViewMode = resolve()

export function useViewMode(): ViewMode {
  return mode
}

/**
 * Optional `?stop=<label>` query param — when set, the scene snaps the render camera
 * to that camera stop on load. Used by:
 *   - the Playwright comparison loop (deterministic per-stop framing vs `docs/renders/refs/`)
 *   - shareable URLs like `/?stop=guitar` to land directly on a view.
 *
 * The label is the friendly `label` field from `cameraStops.ts` (lowercased,
 * "bookshelfplant" → "bookshelf" is the user-facing simplification).
 */
export function useStopParam(): string | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('stop')
  return value ? value.toLowerCase() : null
}
