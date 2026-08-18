import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PRELOAD_OUT_MS } from '@/ui/Preloader'
import { useLoading } from '@/state/loading'

/**
 * Même piège que pour la bulle : le démontage différé (Preloader.tsx) et le
 * fondu CSS (.preload--out, durée --t-preload-out) sont deux implémentations du
 * même budget. Désynchronisés, le preloader se démonte en plein fondu — ou
 * traîne invisible AU-DESSUS du canvas.
 */
describe('preloader exit budget', () => {
  it('PRELOAD_OUT_MS matches --t-preload-out in tokens.css', () => {
    const css = readFileSync('docs/design/tokens.css', 'utf8')
    const m = css.match(/--t-preload-out:\s*(\d+)ms/)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBe(PRELOAD_OUT_MS)
  })
})

/**
 * La progression est le seul contenu du preloader : une barre qui recule ou qui
 * invente un pourcentage est précisément ce que la DoD de #25 interdit.
 */
describe('loading progress', () => {
  const reset = () => useLoading.setState({ loaded: 0, total: 0, fraction: 0 })

  it('reports the byte fraction of the .glb', () => {
    reset()
    useLoading.getState().report(1_479_194, 2_958_388)
    expect(useLoading.getState().fraction).toBeCloseTo(0.5)
  })

  it('never goes backwards', () => {
    reset()
    const { report } = useLoading.getState()
    report(2_000_000, 2_958_388)
    report(100, 2_958_388) // une relecture tardive, ou un total réévalué
    expect(useLoading.getState().fraction).toBeCloseTo(2_000_000 / 2_958_388)
  })

  it('stays at zero when the server gives no Content-Length', () => {
    reset()
    // `lengthComputable` faux → total 0 : la barre passe en indéterminé plutôt
    // que d'afficher un pourcentage qu'on ne connaît pas.
    useLoading.getState().report(1_000_000, 0)
    expect(useLoading.getState().fraction).toBe(0)
    expect(useLoading.getState().total).toBe(0)
  })

  it('clamps a total that under-reports the body', () => {
    reset()
    useLoading.getState().report(3_000_000, 2_958_388)
    expect(useLoading.getState().fraction).toBe(1)
  })
})
