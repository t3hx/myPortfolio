/**
 * URL-driven view modes for the portfolio scene.
 *
 *   /              -> 'tour'  (guided camera tour with HUD buttons — default)
 *   /?debug        -> 'tour'  (explicit alias; useful as a stable URL for diagnostics)
 *   /?debug-fly    -> 'fly'   (free first-person navigation, no HUD)
 *
 * Mode is resolved once at module load — switching modes is a page reload, by design.
 * That keeps the canvas/camera lifecycle simple (no mid-session swap of control rigs).
 */
export type ViewMode = 'tour' | 'fly'

function resolve(): ViewMode {
  if (typeof window === 'undefined') return 'tour'
  const params = new URLSearchParams(window.location.search)
  if (params.has('debug-fly')) return 'fly'
  return 'tour'
}

const mode: ViewMode = resolve()

export function useViewMode(): ViewMode {
  return mode
}
