import { useEffect, useState } from 'react'
import { useInteraction } from '@/state/interaction'

/**
 * La visée du télescope (issue #106).
 *
 * Cliquer le télescope déclenchait déjà l'excursion vers la lune et l'échange
 * `Outside_Moon` → `Outside_Moon_Detailed`, mais rien ne disait qu'on regardait
 * DANS un télescope : on volait vers la lune, plein cadre. Ce cache circulaire
 * est ce qui fait la différence entre une caméra qui se déplace et un oculaire.
 *
 * **C'est un dégradé radial en DOM, pas une seconde passe de rendu.** La spec
 * (`docs/PORTFOLIO_3D_INTERACTIONS.md` § 2.2) laissait le choix. Le DOM gagne
 * pour deux raisons : la scène est un bake non éclairé qu'on ne retouche pas,
 * et une passe de rendu supplémentaire serait un coût GPU permanent pour ce qui
 * n'est qu'un dégradé.
 *
 * **Il n'est pas modal.** À `--z-bubble` (100) il passe SOUS la barre de menu :
 * à 300 il la couvrirait et `Échap` deviendrait la seule sortie. Même arbitrage
 * que le CV — ce qui n'est pas modal ne se comporte pas comme un modal.
 */

/** Doit égaler `--t-scope-out` de tokens.css — `tests/scope.test.ts` est la
 *  seule chose qui relie les deux. */
export const SCOPE_OUT_MS = 260

export function TelescopeScope() {
  const phase = useInteraction((s) => s.phase)
  const visible = phase === 'telescope'

  // Démontage différé, comme la bulle, la fiche et le CV : `visible` à false
  // lance le fondu, le démontage suit. Démonter tout de suite emporterait la
  // sortie avec le composant, et le cache disparaîtrait d'un coup alors que la
  // caméra, elle, met 1,6 s à revenir.
  const [mounted, setMounted] = useState(visible)
  useEffect(() => {
    if (visible) {
      setMounted(true)
      return
    }
    const timer = window.setTimeout(() => setMounted(false), SCOPE_OUT_MS)
    return () => window.clearTimeout(timer)
  }, [visible])

  if (!mounted) return null

  return (
    <div className={visible ? 'scope' : 'scope scope--out'} aria-hidden="true">
      {/* Quatre repères au BORD de l'ouverture, jamais une croix au centre :
          le centre, c'est la lune, et on ne la barre pas. */}
      <div className="scope__reticle">
        <span className="scope__tick scope__tick--n" />
        <span className="scope__tick scope__tick--s" />
        <span className="scope__tick scope__tick--w" />
        <span className="scope__tick scope__tick--e" />
      </div>
    </div>
  )
}
