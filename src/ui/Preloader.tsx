import { useEffect, useState } from 'react'
import { Logo } from '@/ui/Logo'
import { useInteraction } from '@/state/interaction'
import { useLoading } from '@/state/loading'

/**
 * L'écran 0b du design system, recréé depuis
 * `docs/design/screens/0b-preloader.html` (issue #25). L'anatomie vit dans
 * `docs/design/tokens.css` — ce composant n'apporte que les deux signaux.
 *
 * Ils sont DEUX, et c'est le cœur du sujet :
 *
 * - `fraction` (octets du .glb) fait avancer la barre. Mesuré : 3 Mo, par
 *   paquets de 64 Ko, strictement croissant.
 * - `ready` (la scène est parsée et ses matériaux reconstruits) fait
 *   DISPARAÎTRE l'écran. Rien d'autre.
 *
 * Entre les deux il y a une queue muette — décodage draco, 14 textures webp,
 * reconstruction de 146 matériaux — mesurée à 300 ms sur un poste rapide, et
 * qui n'émet aucune progression. Si la barre atteignait 100 % à la fin du
 * téléchargement, elle y resterait plantée pendant toute cette queue et se
 * lirait comme un blocage. Les octets ne remplissent donc que `BYTES_SHARE` de
 * la barre : sur le budget réseau documenté (2 à 4 s pour 3 Mo), le
 * téléchargement pèse ~87 % de l'attente. Ce n'est pas une animation d'attente
 * — la barre ne bouge jamais sans octets reçus.
 */

/** Doit suivre --t-preload-out (tokens.css) — synchro verrouillée par tests/preloader.test.ts. */
export const PRELOAD_OUT_MS = 320

/** Part de la barre que possèdent les octets ; le reste est la queue de décodage. */
export const BYTES_SHARE = 0.9

export function Preloader() {
  const ready = useInteraction((s) => s.ready)
  const fraction = useLoading((s) => s.fraction)
  const known = useLoading((s) => s.total > 0)
  // Initialisé depuis `ready` et non à `true` : la scène reste chargée d'un
  // passage à l'autre (cache useLoader, store zustand). Rouvrir la 3D via
  // `?choose` monterait sinon un preloader déjà en fondu au-dessus d'une pièce
  // prête — 320 ms de flash pour rien.
  const [mounted, setMounted] = useState(() => !useInteraction.getState().ready)

  // Démontage, pas simple masquage : le preloader ne doit rien laisser au-dessus
  // du canvas une fois la visite commencée (les captures `?stop=` en dépendent).
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => setMounted(false), PRELOAD_OUT_MS)
    return () => window.clearTimeout(timer)
  }, [ready])

  if (!mounted) return null

  const progress = ready ? 1 : fraction * BYTES_SHARE
  const pct = Math.round(progress * 100)

  return (
    <div
      className={`preload${ready ? ' preload--out' : ''}`}
      role="status"
      aria-label="Chargement"
    >
      <Logo className="preload__logo" />
      <div>
        <div className={`preload__bar${known ? '' : ' preload__bar--unknown'}`}>
          <div className="preload__fill" style={known ? { width: `${pct}%` } : undefined}>
            <div className="preload__head" />
          </div>
        </div>
        <div className="preload__row">
          <span className="preload__copy">On allume les lampes…</span>
          {known && <span className="preload__pct">{pct} %</span>}
        </div>
      </div>
    </div>
  )
}
